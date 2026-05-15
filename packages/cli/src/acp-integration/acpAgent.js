/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { APPROVAL_MODE_INFO, APPROVAL_MODES, AuthType, clearCachedCredentialFile, createDebugLogger, VivekMindOAuth2Event, vivekmindOAuth2Events, MCPServerConfig, SessionService, SESSION_TITLE_MAX_LENGTH, tokenLimit, SessionStartSource, SessionEndReason, } from '@vivekmind/core';
import { AgentSideConnection, RequestError, ndJsonStream, PROTOCOL_VERSION, } from '@agentclientprotocol/sdk';
import { buildAuthMethods } from './authMethods.js';
import { AcpFileSystemService } from './service/filesystem.js';
import { Readable, Writable } from 'node:stream';
import { loadSettings, SettingScope } from '../config/settings.js';
import { z } from 'zod';
import { loadCliConfig } from '../config/config.js';
import { Session } from './session/Session.js';
import { formatAcpModelId } from '../utils/acpModelUtils.js';
import { runWithAcpRuntimeOutputDir } from './runtimeOutputDirContext.js';
import { runExitCleanup } from '../utils/cleanup.js';
const debugLogger = createDebugLogger('ACP_AGENT');
export async function runAcpAgent(config, settings, argv) {
    // Initialize config to set up hookSystem (required for SessionStart/SessionEnd hooks)
    // This is needed because gemini.tsx calls runAcpAgent without calling config.initialize()
    await config.initialize();
    const stdout = Writable.toWeb(process.stdout);
    const stdin = Readable.toWeb(process.stdin);
    // Stdout is used to send messages to the client, so console.log/console.info
    // messages to stderr so that they don't interfere with ACP.
    console.log = console.error;
    console.info = console.error;
    console.debug = console.error;
    const stream = ndJsonStream(stdout, stdin);
    const connection = new AgentSideConnection((conn) => new VivekMindAgent(config, settings, argv, conn), stream);
    // Handle SIGTERM/SIGINT for graceful shutdown.
    // Without this, signal handlers registered elsewhere in the CLI
    // (e.g., stdin raw mode restoration) override the default exit behavior,
    // causing the ACP process to ignore termination signals.
    let shuttingDown = false;
    let sessionEndFired = false;
    // Helper to fire SessionEnd hook once, preventing double-fire from both
    // shutdown handler path and connection.closed path.
    const fireSessionEndOnce = async (reason) => {
        if (sessionEndFired)
            return;
        sessionEndFired = true;
        const hookSystem = config.getHookSystem?.();
        const hooksEnabled = !config.getDisableAllHooks?.();
        if (hooksEnabled && hookSystem && config.hasHooksForEvent?.('SessionEnd')) {
            try {
                await hookSystem.fireSessionEndEvent(reason);
            }
            catch (err) {
                debugLogger.warn(`SessionEnd hook failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    };
    const shutdownHandler = async () => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        debugLogger.debug('[ACP] Shutdown signal received, closing streams');
        // Fire SessionEnd hook for all active sessions (aligned with core path)
        await fireSessionEndOnce(SessionEndReason.Other);
        try {
            process.stdin.destroy();
        }
        catch {
            // stdin may already be closed
        }
        try {
            process.stdout.destroy();
        }
        catch {
            // stdout may already be closed
        }
        // Clean up child processes (MCP servers, etc.) and force exit.
        // Without this, orphan subprocesses keep the Node.js event loop alive
        // and the CLI process never terminates after the IDE disconnects.
        runExitCleanup()
            .catch((err) => {
            debugLogger.error('[ACP] Cleanup error:', err);
        })
            .finally(() => {
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
    await connection.closed;
    // Connection closed by IDE - fire SessionEnd hook (aligned with core path)
    await fireSessionEndOnce(SessionEndReason.PromptInputExit);
    process.off('SIGTERM', shutdownHandler);
    process.off('SIGINT', shutdownHandler);
}
export function toStdioServer(server) {
    if ('command' in server && 'args' in server && 'env' in server) {
        return server;
    }
    return undefined;
}
export function toSseServer(server) {
    if ('type' in server && server.type === 'sse') {
        return server;
    }
    return undefined;
}
export function toHttpServer(server) {
    if ('type' in server && server.type === 'http') {
        return server;
    }
    return undefined;
}
class VivekMindAgent {
    config;
    settings;
    argv;
    connection;
    sessions = new Map();
    clientCapabilities;
    constructor(config, settings, argv, connection) {
        this.config = config;
        this.settings = settings;
        this.argv = argv;
        this.connection = connection;
    }
    async initialize(args) {
        this.clientCapabilities = args.clientCapabilities;
        const authMethods = buildAuthMethods();
        const version = process.env['CLI_VERSION'] || process.version;
        return {
            protocolVersion: PROTOCOL_VERSION,
            agentInfo: {
                name: 'vivekmind',
                title: 'VivekMind',
                version,
            },
            authMethods,
            agentCapabilities: {
                loadSession: true,
                promptCapabilities: {
                    image: true,
                    audio: true,
                    embeddedContext: true,
                },
                sessionCapabilities: {
                    list: {},
                    resume: {},
                },
                mcpCapabilities: {
                    sse: true,
                    http: true,
                },
            },
        };
    }
    async authenticate({ methodId }) {
        const method = z.nativeEnum(AuthType).parse(methodId);
        let authUri;
        const authUriHandler = (deviceAuth) => {
            authUri = deviceAuth.verification_uri_complete;
            void this.connection.extNotification('authenticate/update', {
                _meta: { authUri },
            });
        };
        if (method === AuthType.VIVEKMIND_OAUTH) {
            vivekmindOAuth2Events.once(VivekMindOAuth2Event.AuthUri, authUriHandler);
        }
        await clearCachedCredentialFile();
        try {
            await this.config.refreshAuth(method);
            this.settings.setValue(SettingScope.User, 'security.auth.selectedType', method);
        }
        finally {
            if (method === AuthType.VIVEKMIND_OAUTH) {
                vivekmindOAuth2Events.off(VivekMindOAuth2Event.AuthUri, authUriHandler);
            }
        }
    }
    async newSession({ cwd, mcpServers, }) {
        const config = await this.newSessionConfig(cwd, mcpServers);
        await this.ensureAuthenticated(config);
        this.setupFileSystem(config);
        const session = await this.createAndStoreSession(config);
        const availableModels = this.buildAvailableModels(config);
        const modesData = this.buildModesData(config);
        const configOptions = this.buildConfigOptions(config);
        return {
            sessionId: session.getId(),
            models: availableModels,
            modes: modesData,
            configOptions,
        };
    }
    async loadSession(params) {
        const exists = await runWithAcpRuntimeOutputDir(this.settings, params.cwd, async () => {
            const sessionService = new SessionService(params.cwd);
            return sessionService.sessionExists(params.sessionId);
        });
        const config = await this.newSessionConfig(params.cwd, params.mcpServers, params.sessionId, exists);
        await this.ensureAuthenticated(config);
        this.setupFileSystem(config);
        const sessionData = config.getResumedSessionData();
        await this.createAndStoreSession(config, sessionData?.conversation);
        const modesData = this.buildModesData(config);
        const availableModels = this.buildAvailableModels(config);
        const configOptions = this.buildConfigOptions(config);
        return {
            modes: modesData,
            models: availableModels,
            configOptions,
        };
    }
    async unstable_listSessions(params) {
        const cwd = params.cwd || process.cwd();
        const numericCursor = params.cursor ? Number(params.cursor) : undefined;
        // The ACP spec's ListSessionsRequest doesn't include a page-size field,
        // so the SDK's zod validator strips any top-level `size` the client sends
        // before it reaches this handler. Carry page size through `_meta.size`
        // (same pattern filesystem.ts uses for `_meta.bom` / `_meta.encoding`).
        const metaSize = params._meta?.['size'];
        const size = typeof metaSize === 'number' && metaSize > 0
            ? Math.floor(metaSize)
            : undefined;
        const result = await runWithAcpRuntimeOutputDir(this.settings, cwd, () => {
            const sessionService = new SessionService(cwd);
            return sessionService.listSessions({
                cursor: Number.isNaN(numericCursor) ? undefined : numericCursor,
                size,
            });
        });
        const sessions = result.items.map((item) => ({
            cwd: item.cwd,
            sessionId: item.sessionId,
            title: item.customTitle || item.prompt || '(session)',
            updatedAt: new Date(item.mtime).toISOString(),
        }));
        return {
            sessions,
            nextCursor: result.nextCursor != null ? String(result.nextCursor) : undefined,
        };
    }
    async setSessionMode(params) {
        const session = this.sessions.get(params.sessionId);
        if (!session) {
            throw RequestError.invalidParams(undefined, `Session not found for id: ${params.sessionId}`);
        }
        return session.setMode(params);
    }
    async unstable_setSessionModel(params) {
        const session = this.sessions.get(params.sessionId);
        if (!session) {
            throw RequestError.invalidParams(undefined, `Session not found for id: ${params.sessionId}`);
        }
        return await session.setModel(params);
    }
    async setSessionConfigOption(params) {
        const { sessionId, configId, value } = params;
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw RequestError.invalidParams(undefined, `Session not found for id: ${sessionId}`);
        }
        switch (configId) {
            case 'mode': {
                await this.setSessionMode({
                    sessionId,
                    modeId: value,
                });
                break;
            }
            case 'model': {
                await this.unstable_setSessionModel({
                    sessionId,
                    modelId: value,
                });
                break;
            }
            default:
                throw RequestError.invalidParams(undefined, `Unsupported configId: ${configId}`);
        }
        return {
            configOptions: this.buildConfigOptions(session.getConfig()),
        };
    }
    async prompt(params) {
        const session = this.sessions.get(params.sessionId);
        if (!session) {
            throw new Error(`Session not found: ${params.sessionId}`);
        }
        return session.prompt(params);
    }
    async cancel(params) {
        const session = this.sessions.get(params.sessionId);
        if (!session) {
            throw new Error(`Session not found: ${params.sessionId}`);
        }
        await session.cancelPendingPrompt();
    }
    async extMethod(method, params) {
        const cwd = params['cwd'] || process.cwd();
        const SESSION_ID_RE = /^[0-9a-fA-F-]{32,36}$/;
        switch (method) {
            case 'deleteSession': {
                const sessionId = params['sessionId'];
                if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
                    throw RequestError.invalidParams(undefined, 'Invalid or missing sessionId');
                }
                const success = await runWithAcpRuntimeOutputDir(this.settings, cwd, async () => {
                    const sessionService = new SessionService(cwd);
                    return sessionService.removeSession(sessionId);
                });
                return { success };
            }
            case 'renameSession': {
                const sessionId = params['sessionId'];
                const title = params['title'];
                if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
                    throw RequestError.invalidParams(undefined, 'Invalid or missing sessionId');
                }
                if (!title || typeof title !== 'string') {
                    throw RequestError.invalidParams(undefined, 'Invalid or missing title');
                }
                if (title.length > SESSION_TITLE_MAX_LENGTH) {
                    throw RequestError.invalidParams(undefined, `Title too long (max ${SESSION_TITLE_MAX_LENGTH} chars)`);
                }
                const success = await runWithAcpRuntimeOutputDir(this.settings, cwd, async () => {
                    const sessionService = new SessionService(cwd);
                    return sessionService.renameSession(sessionId, title);
                });
                return { success };
            }
            case 'getAccountInfo': {
                const sessionId = params['sessionId'];
                const session = sessionId ? this.sessions.get(sessionId) : undefined;
                const config = session ? session.getConfig() : this.config;
                const cfg = config.getContentGeneratorConfig();
                return {
                    authType: cfg?.authType ?? config.getAuthType() ?? null,
                    model: cfg?.model ?? config.getModel() ?? null,
                    baseUrl: cfg?.baseUrl ?? null,
                    apiKeyEnvKey: cfg?.apiKeyEnvKey ?? null,
                };
            }
            default:
                throw RequestError.methodNotFound(method);
        }
    }
    // --- private helpers ---
    async newSessionConfig(cwd, mcpServers, sessionId, resume) {
        this.settings = loadSettings(cwd);
        const mergedMcpServers = { ...this.settings.merged.mcpServers };
        for (const server of mcpServers) {
            const stdioServer = toStdioServer(server);
            if (stdioServer) {
                const env = {};
                for (const { name: envName, value } of stdioServer.env) {
                    env[envName] = value;
                }
                mergedMcpServers[stdioServer.name] = new MCPServerConfig(stdioServer.command, stdioServer.args, env, cwd);
                continue;
            }
            const sseServer = toSseServer(server);
            if (sseServer) {
                const headers = {};
                for (const { name: headerName, value } of sseServer.headers) {
                    headers[headerName] = value;
                }
                mergedMcpServers[sseServer.name] = new MCPServerConfig(undefined, undefined, undefined, undefined, sseServer.url, undefined, Object.keys(headers).length > 0 ? headers : undefined);
                continue;
            }
            const httpServer = toHttpServer(server);
            if (httpServer) {
                const headers = {};
                for (const { name: headerName, value } of httpServer.headers) {
                    headers[headerName] = value;
                }
                mergedMcpServers[httpServer.name] = new MCPServerConfig(undefined, undefined, undefined, undefined, undefined, httpServer.url, Object.keys(headers).length > 0 ? headers : undefined);
                continue;
            }
        }
        const settings = { ...this.settings.merged, mcpServers: mergedMcpServers };
        const argvForSession = {
            ...this.argv,
            ...(resume ? { resume: sessionId } : { sessionId }),
            continue: false,
        };
        const config = await loadCliConfig(settings, argvForSession, cwd, [], 
        // Pass separated hooks for proper source attribution
        {
            userHooks: this.settings.getUserHooks(),
            projectHooks: this.settings.getProjectHooks(),
        });
        await config.initialize();
        return config;
    }
    async ensureAuthenticated(config) {
        const selectedType = config.getModelsConfig().getCurrentAuthType();
        if (!selectedType) {
            throw RequestError.authRequired({ authMethods: this.pickAuthMethodsForAuthRequired() }, 'Use VivekMind CLI to authenticate first.');
        }
        try {
            await config.refreshAuth(selectedType, true);
        }
        catch (e) {
            debugLogger.error(`Authentication failed: ${e}`);
            throw RequestError.authRequired({
                authMethods: this.pickAuthMethodsForAuthRequired(selectedType, e),
            }, 'Authentication failed: ' + e.message);
        }
    }
    pickAuthMethodsForAuthRequired(selectedType, error) {
        const authMethods = buildAuthMethods();
        const errorMessage = this.extractErrorMessage(error);
        if (errorMessage?.includes('vivekmind-oauth') ||
            errorMessage?.includes('VivekMind OAuth')) {
            const vivekmindOAuthMethods = authMethods.filter((m) => m.id === AuthType.VIVEKMIND_OAUTH);
            return vivekmindOAuthMethods.length ? vivekmindOAuthMethods : authMethods;
        }
        if (selectedType) {
            const matched = authMethods.filter((m) => m.id === selectedType);
            return matched.length ? matched : authMethods;
        }
        return authMethods;
    }
    extractErrorMessage(error) {
        if (error instanceof Error)
            return error.message;
        if (typeof error === 'object' &&
            error != null &&
            'message' in error &&
            typeof error.message === 'string') {
            return error.message;
        }
        if (typeof error === 'string')
            return error;
        return undefined;
    }
    setupFileSystem(config) {
        if (!this.clientCapabilities?.fs)
            return;
        const acpFileSystemService = new AcpFileSystemService(this.connection, config.getSessionId(), this.clientCapabilities.fs, config.getFileSystemService());
        config.setFileSystemService(acpFileSystemService);
    }
    async createAndStoreSession(config, conversation) {
        const sessionId = config.getSessionId();
        const geminiClient = config.getGeminiClient();
        if (!geminiClient.isInitialized()) {
            await geminiClient.initialize();
        }
        const session = new Session(sessionId, config, this.connection, this.settings);
        this.sessions.set(sessionId, session);
        // Fire SessionStart hook (aligned with core path)
        const hookSystem = config.getHookSystem();
        const hooksEnabled = !config.getDisableAllHooks();
        if (hooksEnabled && hookSystem && config.hasHooksForEvent('SessionStart')) {
            const source = conversation
                ? SessionStartSource.Resume
                : SessionStartSource.Startup;
            const model = config.getModel();
            const permissionMode = String(config.getApprovalMode());
            try {
                await hookSystem.fireSessionStartEvent(source, model, permissionMode);
            }
            catch (err) {
                debugLogger.warn(`SessionStart hook failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        setTimeout(async () => {
            await session.sendAvailableCommandsUpdate();
        }, 0);
        if (conversation && conversation.messages) {
            await session.replayHistory(conversation.messages);
        }
        // Install rewriter AFTER history replay to avoid rewriting historical messages
        session.installRewriter();
        return session;
    }
    buildAvailableModels(config) {
        const rawCurrentModelId = (config.getModel() ||
            this.config.getModel() ||
            '').trim();
        const currentAuthType = config.getAuthType();
        const allConfiguredModels = config.getAllConfiguredModels();
        const activeRuntimeSnapshot = config.getActiveRuntimeModelSnapshot?.();
        const currentModelId = activeRuntimeSnapshot
            ? formatAcpModelId(activeRuntimeSnapshot.id, activeRuntimeSnapshot.authType)
            : this.formatCurrentModelId(rawCurrentModelId, currentAuthType);
        const mappedAvailableModels = allConfiguredModels.map((model) => {
            const effectiveModelId = model.isRuntimeModel && model.runtimeSnapshotId
                ? model.runtimeSnapshotId
                : model.id;
            return {
                modelId: formatAcpModelId(effectiveModelId, model.authType),
                name: model.label,
                description: model.description ?? null,
                _meta: {
                    contextLimit: model.contextWindowSize ?? tokenLimit(model.id),
                },
            };
        });
        return {
            currentModelId,
            availableModels: mappedAvailableModels,
        };
    }
    buildModesData(config) {
        const currentApprovalMode = config.getApprovalMode();
        const availableModes = APPROVAL_MODES.map((mode) => ({
            id: mode,
            name: APPROVAL_MODE_INFO[mode].name,
            description: APPROVAL_MODE_INFO[mode].description,
        }));
        return {
            currentModeId: currentApprovalMode,
            availableModes,
        };
    }
    buildConfigOptions(config) {
        const currentApprovalMode = config.getApprovalMode();
        const allConfiguredModels = config.getAllConfiguredModels();
        const rawCurrentModelId = (config.getModel() || '').trim();
        const currentAuthType = config.getAuthType?.();
        const activeRuntimeSnapshot = config.getActiveRuntimeModelSnapshot?.();
        const currentModelId = activeRuntimeSnapshot
            ? formatAcpModelId(activeRuntimeSnapshot.id, activeRuntimeSnapshot.authType)
            : this.formatCurrentModelId(rawCurrentModelId, currentAuthType);
        const modeOptions = APPROVAL_MODES.map((mode) => ({
            value: mode,
            name: APPROVAL_MODE_INFO[mode].name,
            description: APPROVAL_MODE_INFO[mode].description,
        }));
        const modeConfigOption = {
            id: 'mode',
            name: 'Mode',
            description: 'Session permission mode',
            category: 'mode',
            type: 'select',
            currentValue: currentApprovalMode,
            options: modeOptions,
        };
        const modelOptions = allConfiguredModels.map((model) => {
            const effectiveModelId = model.isRuntimeModel && model.runtimeSnapshotId
                ? model.runtimeSnapshotId
                : model.id;
            return {
                value: formatAcpModelId(effectiveModelId, model.authType),
                name: model.label,
                description: model.description ?? '',
            };
        });
        const modelConfigOption = {
            id: 'model',
            name: 'Model',
            description: 'AI model to use',
            category: 'model',
            type: 'select',
            currentValue: currentModelId,
            options: modelOptions,
        };
        return [modeConfigOption, modelConfigOption];
    }
    formatCurrentModelId(baseModelId, authType) {
        if (!baseModelId)
            return baseModelId;
        return authType ? formatAcpModelId(baseModelId, authType) : baseModelId;
    }
}
//# sourceMappingURL=acpAgent.js.map