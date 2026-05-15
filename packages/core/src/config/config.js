/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
// External dependencies
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { ArenaAgentClient } from '../agents/arena/ArenaAgentClient.js';
// Core
import { BaseLlmClient } from '../core/baseLlmClient.js';
import { GeminiClient } from '../core/client.js';
import { AuthType, createContentGenerator, resolveContentGeneratorConfigWithSources, } from '../core/contentGenerator.js';
// Services
import { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import { StandardFileSystemService, } from '../services/fileSystemService.js';
import { GitService } from '../services/gitService.js';
import { CronScheduler } from '../services/cronScheduler.js';
import { setGeminiMdFilename } from '../memory/const.js';
import { canUseRipgrep } from '../utils/ripgrepUtils.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { ToolNames } from '../tools/tool-names.js';
// Other modules
import { ideContextStore } from '../ide/ideContext.js';
import { InputFormat, OutputFormat } from '../output/types.js';
import { PromptRegistry } from '../prompts/prompt-registry.js';
import { SkillManager } from '../skills/skill-manager.js';
import { PermissionManager } from '../permissions/permission-manager.js';
import { SubagentManager } from '../subagents/subagent-manager.js';
import { BackgroundTaskRegistry } from '../agents/background-tasks.js';
import { MonitorRegistry } from '../services/monitorRegistry.js';
import { BackgroundAgentResumeService } from '../agents/background-agent-resume.js';
import { BackgroundShellRegistry } from '../services/backgroundShellRegistry.js';
import { FileReadCache } from '../services/fileReadCache.js';
import { DEFAULT_OTLP_ENDPOINT, DEFAULT_TELEMETRY_TARGET, isTelemetrySdkInitialized, initializeTelemetry, shutdownTelemetry, logStartSession, logRipgrepFallback, RipgrepFallbackEvent, StartSessionEvent, } from '../telemetry/index.js';
import { ExtensionManager, } from '../extension/extensionManager.js';
import { HookSystem, createHookOutput } from '../hooks/index.js';
import { MessageBus } from '../confirmation-bus/message-bus.js';
import { MessageBusType, } from '../confirmation-bus/types.js';
import { PermissionMode, NotificationType, } from '../hooks/types.js';
import { fireNotificationHook } from '../core/toolHookTriggers.js';
// Utils
import { shouldAttemptBrowserLaunch } from '../utils/browser.js';
import { FileExclusions } from '../utils/ignorePatterns.js';
import { shouldDefaultToNodePty } from '../utils/shell-utils.js';
import { WorkspaceContext } from '../utils/workspaceContext.js';
import {} from '../utils/tool-utils.js';
import { getErrorMessage } from '../utils/errors.js';
import { normalizeProxyUrl } from '../utils/proxyUtils.js';
import { DEFAULT_FILE_FILTERING_OPTIONS, DEFAULT_MEMORY_FILE_FILTERING_OPTIONS, } from './constants.js';
import { DEFAULT_VIVEKMIND_EMBEDDING_MODEL } from './models.js';
import { Storage } from './storage.js';
import { ChatRecordingService } from '../services/chatRecordingService.js';
import { SessionService, } from '../services/sessionService.js';
import { randomUUID } from 'node:crypto';
import { loadServerHierarchicalMemory } from '../utils/memoryDiscovery.js';
import { ConditionalRulesRegistry } from '../utils/rulesDiscovery.js';
import { createDebugLogger, setDebugLogSession, } from '../utils/debugLogger.js';
import { getAutoMemoryRoot } from '../memory/paths.js';
import { readAutoMemoryIndex } from '../memory/store.js';
import { MemoryManager } from '../memory/manager.js';
import { ModelsConfig, } from '../models/index.js';
export { DEFAULT_FILE_FILTERING_OPTIONS, DEFAULT_MEMORY_FILE_FILTERING_OPTIONS, };
export var ApprovalMode;
(function (ApprovalMode) {
    ApprovalMode["PLAN"] = "plan";
    ApprovalMode["DEFAULT"] = "default";
    ApprovalMode["AUTO_EDIT"] = "auto-edit";
    ApprovalMode["YOLO"] = "yolo";
})(ApprovalMode || (ApprovalMode = {}));
export const APPROVAL_MODES = Object.values(ApprovalMode);
/**
 * Detailed information about each approval mode.
 * Used for UI display and protocol responses.
 */
export const APPROVAL_MODE_INFO = {
    [ApprovalMode.PLAN]: {
        id: ApprovalMode.PLAN,
        name: 'Plan',
        description: 'Analyze only, do not modify files or execute commands',
    },
    [ApprovalMode.DEFAULT]: {
        id: ApprovalMode.DEFAULT,
        name: 'Default',
        description: 'Require approval for file edits or shell commands',
    },
    [ApprovalMode.AUTO_EDIT]: {
        id: ApprovalMode.AUTO_EDIT,
        name: 'Auto Edit',
        description: 'Automatically approve file edits',
    },
    [ApprovalMode.YOLO]: {
        id: ApprovalMode.YOLO,
        name: 'YOLO',
        description: 'Automatically approve all tools',
    },
};
export const DEFAULT_TRUNCATE_TOOL_OUTPUT_THRESHOLD = 25_000;
export const DEFAULT_TRUNCATE_TOOL_OUTPUT_LINES = 1000;
export class MCPServerConfig {
    command;
    args;
    env;
    cwd;
    url;
    httpUrl;
    headers;
    tcp;
    timeout;
    trust;
    description;
    includeTools;
    excludeTools;
    extensionName;
    oauth;
    authProviderType;
    targetAudience;
    targetServiceAccount;
    type;
    constructor(
    // For stdio transport
    command, args, env, cwd, 
    // For sse transport
    url, 
    // For streamable http transport
    httpUrl, headers, 
    // For websocket transport
    tcp, 
    // Common
    timeout, trust, 
    // Metadata
    description, includeTools, excludeTools, extensionName, 
    // OAuth configuration
    oauth, authProviderType, 
    // Service Account Configuration
    /* targetAudience format: CLIENT_ID.apps.googleusercontent.com */
    targetAudience, 
    /* targetServiceAccount format: <service-account-name>@<project-num>.iam.gserviceaccount.com */
    targetServiceAccount, 
    // SDK MCP server type - 'sdk' indicates server runs in SDK process
    type) {
        this.command = command;
        this.args = args;
        this.env = env;
        this.cwd = cwd;
        this.url = url;
        this.httpUrl = httpUrl;
        this.headers = headers;
        this.tcp = tcp;
        this.timeout = timeout;
        this.trust = trust;
        this.description = description;
        this.includeTools = includeTools;
        this.excludeTools = excludeTools;
        this.extensionName = extensionName;
        this.oauth = oauth;
        this.authProviderType = authProviderType;
        this.targetAudience = targetAudience;
        this.targetServiceAccount = targetServiceAccount;
        this.type = type;
    }
}
/**
 * Check if an MCP server config represents an SDK server
 */
export function isSdkMcpServerConfig(config) {
    return config.type === 'sdk';
}
export var AuthProviderType;
(function (AuthProviderType) {
    AuthProviderType["DYNAMIC_DISCOVERY"] = "dynamic_discovery";
    AuthProviderType["GOOGLE_CREDENTIALS"] = "google_credentials";
    AuthProviderType["SERVICE_ACCOUNT_IMPERSONATION"] = "service_account_impersonation";
})(AuthProviderType || (AuthProviderType = {}));
function normalizeConfigOutputFormat(format) {
    if (!format) {
        return undefined;
    }
    switch (format) {
        case 'stream-json':
            return OutputFormat.STREAM_JSON;
        case 'json':
        case OutputFormat.JSON:
            return OutputFormat.JSON;
        case 'text':
        case OutputFormat.TEXT:
        default:
            return OutputFormat.TEXT;
    }
}
const DEFAULT_BARE_CORE_TOOLS = [
    ToolNames.READ_FILE,
    ToolNames.EDIT,
    ToolNames.SHELL,
];
export class Config {
    sessionId;
    sessionData;
    debugLogger;
    toolRegistry;
    promptRegistry;
    subagentManager;
    backgroundTaskRegistry = new BackgroundTaskRegistry();
    monitorRegistry = new MonitorRegistry();
    backgroundAgentResumeService;
    backgroundShellRegistry = new BackgroundShellRegistry();
    // Field initializer runs once on the parent Config; child Configs
    // built via Object.create(parent) intentionally do NOT pick this up
    // — see getFileReadCache() for the per-instance lazy initialization
    // that keeps subagent caches isolated from the parent's.
    fileReadCache = new FileReadCache();
    extensionManager;
    skillManager = null;
    permissionManager = null;
    modelInvocableCommandsProvider = null;
    modelInvocableCommandsExecutor = null;
    fileSystemService;
    contentGeneratorConfig;
    contentGeneratorConfigSources = {};
    contentGenerator;
    embeddingModel;
    modelsConfig;
    modelProvidersConfig;
    sandbox;
    targetDir;
    workspaceContext;
    debugMode;
    inputFormat;
    outputFormat;
    includePartialMessages;
    question;
    systemPrompt;
    appendSystemPrompt;
    coreTools;
    allowedTools;
    excludeTools;
    disabledSlashCommands;
    permissionsAllow;
    permissionsAsk;
    permissionsDeny;
    toolDiscoveryCommand;
    toolCallCommand;
    mcpServerCommand;
    mcpServers;
    lspEnabled;
    lspClient;
    allowedMcpServers;
    excludedMcpServers;
    sessionSubagents;
    userMemory;
    sdkMode;
    geminiMdFileCount;
    conditionalRulesRegistry;
    contextRuleExcludes;
    approvalMode;
    prePlanMode;
    accessibility;
    telemetrySettings;
    gitCoAuthor;
    usageStatisticsEnabled;
    fileReadCacheDisabled;
    geminiClient;
    baseLlmClient;
    cronScheduler = null;
    fileFiltering;
    fileDiscoveryService = null;
    gitService = undefined;
    sessionService = undefined;
    chatRecordingService = undefined;
    checkpointing;
    proxy;
    cwd;
    explicitIncludeDirectories;
    bugCommand;
    outputLanguageFilePath;
    noBrowser;
    folderTrustFeature;
    folderTrust;
    ideMode;
    maxSessionTurns;
    clearContextOnIdle;
    sessionTokenLimit;
    listExtensions;
    overrideExtensions;
    cliVersion;
    experimentalZedIntegration = false;
    cronEnabled = false;
    emitToolUseSummaries = true;
    chatRecordingEnabled;
    loadMemoryFromIncludeDirectories = false;
    importFormat;
    chatCompression;
    interactive;
    trustedFolder;
    useRipgrep;
    useBuiltinRipgrep;
    shouldUseNodePtyShell;
    skipNextSpeakerCheck;
    shellExecutionConfig;
    arenaManager = null;
    arenaManagerChangeCallback = null;
    arenaAgentClient;
    agentsSettings;
    skipLoopDetection;
    skipStartupContext;
    bareMode;
    warnings;
    allowedHttpHookUrls;
    onPersistPermissionRuleCallback;
    initialized = false;
    storage;
    fileExclusions;
    truncateToolOutputThreshold;
    truncateToolOutputLines;
    eventEmitter;
    channel;
    jsonFd;
    jsonFile;
    inputFile;
    defaultFileEncoding;
    enableManagedAutoMemory;
    enableManagedAutoDream;
    fastModel;
    disableAllHooks;
    /** User-level hooks (always loaded regardless of trust) */
    userHooks;
    /** Project-level hooks (only loaded in trusted folders) */
    projectHooks;
    /** @deprecated Legacy merged hooks field - use userHooks/projectHooks instead */
    hooks;
    hookSystem;
    messageBus;
    memoryManager;
    modelChangeListeners = new Set();
    constructor(params) {
        this.sessionId = params.sessionId ?? randomUUID();
        this.sessionData = params.sessionData;
        setDebugLogSession(this);
        this.debugLogger = createDebugLogger();
        this.embeddingModel = params.embeddingModel ?? DEFAULT_VIVEKMIND_EMBEDDING_MODEL;
        this.fileSystemService = new StandardFileSystemService();
        this.sandbox = params.sandbox;
        this.targetDir = path.resolve(params.targetDir);
        this.explicitIncludeDirectories = Array.from(new Set(params.includeDirectories ?? []));
        this.workspaceContext = new WorkspaceContext(this.targetDir, this.explicitIncludeDirectories);
        this.debugMode = params.debugMode;
        this.inputFormat = params.inputFormat ?? InputFormat.TEXT;
        const normalizedOutputFormat = normalizeConfigOutputFormat(params.outputFormat ?? params.output?.format);
        this.outputFormat = normalizedOutputFormat ?? OutputFormat.TEXT;
        this.includePartialMessages = params.includePartialMessages ?? false;
        this.question = params.question;
        this.systemPrompt = params.systemPrompt;
        this.appendSystemPrompt = params.appendSystemPrompt;
        this.coreTools = params.coreTools;
        this.allowedTools = params.allowedTools;
        this.excludeTools = params.excludeTools;
        this.disabledSlashCommands = Object.freeze([
            ...(params.disabledSlashCommands ?? []),
        ]);
        this.permissionsAllow = params.permissions?.allow || [];
        this.permissionsAsk = params.permissions?.ask || [];
        this.permissionsDeny = params.permissions?.deny || [];
        this.toolDiscoveryCommand = params.toolDiscoveryCommand;
        this.toolCallCommand = params.toolCallCommand;
        this.mcpServerCommand = params.mcpServerCommand;
        this.mcpServers = params.mcpServers;
        this.lspEnabled = params.lsp?.enabled ?? false;
        this.lspClient = params.lspClient;
        this.allowedMcpServers = params.allowedMcpServers;
        this.excludedMcpServers = params.excludedMcpServers;
        this.sessionSubagents = params.sessionSubagents ?? [];
        this.sdkMode = params.sdkMode ?? false;
        this.userMemory = params.userMemory ?? '';
        this.geminiMdFileCount = params.geminiMdFileCount ?? 0;
        this.contextRuleExcludes = params.contextRuleExcludes ?? [];
        this.approvalMode = params.approvalMode ?? ApprovalMode.DEFAULT;
        this.accessibility = params.accessibility ?? {};
        this.telemetrySettings = {
            enabled: params.telemetry?.enabled ?? false,
            target: params.telemetry?.target ?? DEFAULT_TELEMETRY_TARGET,
            otlpEndpoint: params.telemetry?.otlpEndpoint,
            otlpProtocol: params.telemetry?.otlpProtocol,
            otlpTracesEndpoint: params.telemetry?.otlpTracesEndpoint,
            otlpLogsEndpoint: params.telemetry?.otlpLogsEndpoint,
            otlpMetricsEndpoint: params.telemetry?.otlpMetricsEndpoint,
            logPrompts: params.telemetry?.logPrompts ?? true,
            outfile: params.telemetry?.outfile,
            useCollector: params.telemetry?.useCollector,
        };
        this.gitCoAuthor = {
            enabled: params.gitCoAuthor ?? true,
            name: 'VivekMind',
            email: 'vivekmind@google.com',
        };
        this.usageStatisticsEnabled = params.usageStatisticsEnabled ?? true;
        this.fileReadCacheDisabled = params.fileReadCacheDisabled ?? false;
        this.outputLanguageFilePath = params.outputLanguageFilePath;
        this.fileFiltering = {
            respectGitIgnore: params.fileFiltering?.respectGitIgnore ?? true,
            respectVivekMindIgnore: params.fileFiltering?.respectVivekMindIgnore ?? true,
            enableRecursiveFileSearch: params.fileFiltering?.enableRecursiveFileSearch ?? true,
            enableFuzzySearch: params.fileFiltering?.enableFuzzySearch ?? true,
        };
        this.checkpointing = params.checkpointing ?? false;
        this.proxy = params.proxy;
        this.cwd = params.cwd ?? process.cwd();
        this.fileDiscoveryService = params.fileDiscoveryService ?? null;
        this.bugCommand = params.bugCommand;
        this.maxSessionTurns = params.maxSessionTurns ?? -1;
        this.clearContextOnIdle = {
            toolResultsThresholdMinutes: params.clearContextOnIdle?.toolResultsThresholdMinutes ?? 60,
            toolResultsNumToKeep: params.clearContextOnIdle?.toolResultsNumToKeep ?? 5,
        };
        this.sessionTokenLimit = params.sessionTokenLimit ?? -1;
        this.experimentalZedIntegration =
            params.experimentalZedIntegration ?? false;
        this.cronEnabled = params.cronEnabled ?? false;
        this.emitToolUseSummaries = params.emitToolUseSummaries ?? true;
        this.listExtensions = params.listExtensions ?? false;
        this.overrideExtensions = params.overrideExtensions;
        this.noBrowser = params.noBrowser ?? false;
        this.folderTrustFeature = params.folderTrustFeature ?? false;
        this.folderTrust = params.folderTrust ?? false;
        this.ideMode = params.ideMode ?? false;
        this.modelProvidersConfig = params.modelProvidersConfig;
        this.cliVersion = params.cliVersion;
        this.chatRecordingEnabled = params.chatRecording ?? true;
        this.loadMemoryFromIncludeDirectories =
            params.loadMemoryFromIncludeDirectories ?? false;
        this.importFormat = params.importFormat ?? 'tree';
        this.chatCompression = params.chatCompression;
        this.interactive = params.interactive ?? false;
        this.trustedFolder = params.trustedFolder;
        this.skipLoopDetection = params.skipLoopDetection ?? false;
        this.skipStartupContext = params.skipStartupContext ?? false;
        this.bareMode = params.bareMode ?? false;
        this.warnings = params.warnings ?? [];
        this.allowedHttpHookUrls = params.allowedHttpHookUrls ?? [];
        this.onPersistPermissionRuleCallback = params.onPersistPermissionRule;
        // (web search removed)
        this.useRipgrep = params.useRipgrep ?? true;
        this.useBuiltinRipgrep = params.useBuiltinRipgrep ?? true;
        this.shouldUseNodePtyShell =
            params.shouldUseNodePtyShell ?? shouldDefaultToNodePty();
        this.skipNextSpeakerCheck = params.skipNextSpeakerCheck ?? true;
        this.shellExecutionConfig = {
            terminalWidth: params.shellExecutionConfig?.terminalWidth ?? 80,
            terminalHeight: params.shellExecutionConfig?.terminalHeight ?? 24,
            showColor: params.shellExecutionConfig?.showColor ?? false,
            pager: params.shellExecutionConfig?.pager ?? 'cat',
        };
        this.truncateToolOutputThreshold =
            params.truncateToolOutputThreshold ??
                DEFAULT_TRUNCATE_TOOL_OUTPUT_THRESHOLD;
        this.truncateToolOutputLines =
            params.truncateToolOutputLines ?? DEFAULT_TRUNCATE_TOOL_OUTPUT_LINES;
        this.channel = params.channel;
        this.jsonFd = params.jsonFd;
        this.jsonFile = params.jsonFile;
        this.inputFile = params.inputFile;
        this.defaultFileEncoding = params.defaultFileEncoding;
        this.storage = new Storage(this.targetDir);
        this.inputFormat = params.inputFormat ?? InputFormat.TEXT;
        this.fileExclusions = new FileExclusions(this);
        this.eventEmitter = params.eventEmitter;
        this.arenaAgentClient = ArenaAgentClient.create();
        this.agentsSettings = params.agents ?? {};
        if (params.contextFileName) {
            setGeminiMdFilename(params.contextFileName);
        }
        // Create ModelsConfig for centralized model management
        // Prefer params.authType over generationConfig.authType because:
        // - params.authType preserves undefined (user hasn't selected yet)
        // - generationConfig.authType may have a default value from resolvers
        this.modelsConfig = new ModelsConfig({
            initialAuthType: params.authType ?? params.generationConfig?.authType,
            modelProvidersConfig: this.modelProvidersConfig,
            generationConfig: {
                model: params.model,
                ...(params.generationConfig || {}),
                baseUrl: params.generationConfig?.baseUrl,
            },
            generationConfigSources: params.generationConfigSources,
            onModelChange: this.handleModelChange.bind(this),
        });
        if (this.telemetrySettings.enabled) {
            initializeTelemetry(this);
        }
        const proxyUrl = this.getProxy();
        if (proxyUrl) {
            setGlobalDispatcher(new ProxyAgent(proxyUrl));
        }
        this.geminiClient = new GeminiClient(this);
        this.chatRecordingService = this.chatRecordingEnabled
            ? new ChatRecordingService(this)
            : undefined;
        this.extensionManager = new ExtensionManager({
            workspaceDir: this.targetDir,
            enabledExtensionOverrides: this.overrideExtensions,
            isWorkspaceTrusted: this.isTrustedFolder(),
        });
        this.enableManagedAutoMemory = params.enableManagedAutoMemory ?? true;
        this.enableManagedAutoDream = params.enableManagedAutoDream ?? false;
        this.fastModel = params.fastModel || undefined;
        this.disableAllHooks = params.disableAllHooks ?? false;
        // Store user and project hooks separately for proper source attribution
        this.userHooks = params.userHooks;
        this.projectHooks = params.projectHooks;
        // Legacy: fall back to merged hooks if new fields are not provided
        this.hooks = params.hooks;
        this.memoryManager = new MemoryManager();
    }
    /**
     * Must only be called once, throws if called again.
     * @param options Optional initialization options including sendSdkMcpMessage callback
     */
    async initialize(options) {
        if (this.initialized) {
            throw Error('Config was already initialized');
        }
        this.initialized = true;
        this.debugLogger.info('Config initialization started');
        // Initialize centralized FileDiscoveryService
        this.getFileService();
        if (this.getCheckpointingEnabled()) {
            await this.getGitService();
        }
        this.promptRegistry = new PromptRegistry();
        this.extensionManager.setConfig(this);
        const explicitExtensionNames = this.getExplicitExtensionNames();
        if (!this.getBareMode()) {
            await this.extensionManager.refreshCache();
        }
        else if (explicitExtensionNames.length > 0) {
            await this.extensionManager.refreshCache({
                names: explicitExtensionNames,
            });
        }
        this.debugLogger.debug('Extension manager initialized');
        // Bare mode skips all hook loading and execution.
        if (!this.getDisableAllHooks()) {
            this.hookSystem = new HookSystem(this);
            await this.hookSystem.initialize();
            this.debugLogger.debug('Hook system initialized');
            // Initialize MessageBus for hook execution
            this.messageBus = new MessageBus();
            // Subscribe to HOOK_EXECUTION_REQUEST to execute hooks
            this.messageBus.subscribe(MessageBusType.HOOK_EXECUTION_REQUEST, async (request) => {
                try {
                    const hookSystem = this.hookSystem;
                    if (!hookSystem) {
                        this.messageBus?.publish({
                            type: MessageBusType.HOOK_EXECUTION_RESPONSE,
                            correlationId: request.correlationId,
                            success: false,
                            error: new Error('Hook system not initialized'),
                        });
                        return;
                    }
                    // Check if request was aborted
                    if (request.signal?.aborted) {
                        this.messageBus?.publish({
                            type: MessageBusType.HOOK_EXECUTION_RESPONSE,
                            correlationId: request.correlationId,
                            success: false,
                            error: new Error('Hook execution cancelled (aborted)'),
                        });
                        return;
                    }
                    // Execute the appropriate hook based on eventName
                    let result;
                    let stopHookCount;
                    const input = request.input || {};
                    const signal = request.signal;
                    switch (request.eventName) {
                        case 'UserPromptSubmit':
                            result = await hookSystem.fireUserPromptSubmitEvent(input['prompt'] || '', signal);
                            break;
                        case 'Stop': {
                            const stopResult = await hookSystem.fireStopEvent(input['stop_hook_active'] || false, input['last_assistant_message'] || '', signal);
                            result = stopResult.finalOutput
                                ? createHookOutput('Stop', stopResult.finalOutput)
                                : undefined;
                            stopHookCount = stopResult.allOutputs.length;
                            break;
                        }
                        case 'PreToolUse': {
                            result = await hookSystem.firePreToolUseEvent(input['tool_name'] || '', input['tool_input'] || {}, input['tool_use_id'] || '', input['permission_mode'] ??
                                PermissionMode.Default, signal);
                            break;
                        }
                        case 'PostToolUse':
                            result = await hookSystem.firePostToolUseEvent(input['tool_name'] || '', input['tool_input'] || {}, input['tool_response'] || {}, input['tool_use_id'] || '', input['permission_mode'] || 'default', signal);
                            break;
                        case 'PostToolUseFailure':
                            result = await hookSystem.firePostToolUseFailureEvent(input['tool_use_id'] || '', input['tool_name'] || '', input['tool_input'] || {}, input['error'] || '', input['is_interrupt'], input['permission_mode'] || 'default', signal);
                            break;
                        case 'Notification':
                            result = await hookSystem.fireNotificationEvent(input['message'] || '', input['notification_type'] ||
                                'permission_prompt', input['title'] || undefined, signal);
                            break;
                        case 'PermissionRequest':
                            result = await hookSystem.firePermissionRequestEvent(input['tool_name'] || '', input['tool_input'] || {}, input['permission_mode'] ||
                                PermissionMode.Default, input['permission_suggestions'] || undefined, signal);
                            break;
                        case 'SubagentStart':
                            result = await hookSystem.fireSubagentStartEvent(input['agent_id'] || '', input['agent_type'] || '', input['permission_mode'] ||
                                PermissionMode.Default, signal);
                            break;
                        case 'SubagentStop':
                            result = await hookSystem.fireSubagentStopEvent(input['agent_id'] || '', input['agent_type'] || '', input['agent_transcript_path'] || '', input['last_assistant_message'] || '', input['stop_hook_active'] || false, input['permission_mode'] ||
                                PermissionMode.Default, signal);
                            break;
                        default:
                            this.debugLogger.warn(`Unknown hook event: ${request.eventName}`);
                            result = undefined;
                    }
                    // Send response
                    this.messageBus?.publish({
                        type: MessageBusType.HOOK_EXECUTION_RESPONSE,
                        correlationId: request.correlationId,
                        success: true,
                        output: result,
                        // Include stop hook count for Stop events
                        stopHookCount,
                    });
                }
                catch (error) {
                    this.debugLogger.warn(`Hook execution failed: ${error}`);
                    this.messageBus?.publish({
                        type: MessageBusType.HOOK_EXECUTION_RESPONSE,
                        correlationId: request.correlationId,
                        success: false,
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
            });
            this.debugLogger.debug('MessageBus initialized with hook subscription');
        }
        else {
            this.debugLogger.debug('Hook system disabled, skipping initialization');
        }
        this.subagentManager = new SubagentManager(this);
        this.skillManager = new SkillManager(this);
        if (this.getBareMode()) {
            await this.skillManager.refreshCache();
        }
        else {
            await this.skillManager.startWatching();
        }
        this.debugLogger.debug('Skill manager initialized');
        this.permissionManager = new PermissionManager(this);
        this.permissionManager.initialize();
        this.debugLogger.debug('Permission manager initialized');
        // Load session subagents if they were provided before initialization
        if (this.sessionSubagents.length > 0) {
            this.subagentManager.loadSessionSubagents(this.sessionSubagents);
        }
        if (!this.getBareMode()) {
            await this.extensionManager.refreshCache();
        }
        await this.refreshHierarchicalMemory();
        this.debugLogger.debug('Hierarchical memory loaded');
        this.toolRegistry = await this.createToolRegistry(options?.sendSdkMcpMessage, this.getBareMode() ? { skipDiscovery: true } : undefined);
        this.debugLogger.info(`Tool registry initialized with ${this.toolRegistry.getAllToolNames().length} tools`);
        await this.geminiClient.initialize();
        this.debugLogger.info('Gemini client initialized');
        // Detect and capture runtime model snapshot (from CLI/ENV/credentials)
        this.modelsConfig.detectAndCaptureRuntimeModel();
        // Warm all lazy tool factories so telemetry can access tool metadata synchronously.
        // Use strict mode so a broken built-in tool surfaces immediately at startup.
        await this.toolRegistry.warmAll({ strict: true });
        logStartSession(this, new StartSessionEvent(this));
        this.debugLogger.info('Config initialization completed');
    }
    async refreshHierarchicalMemory() {
        const { memoryContent, fileCount, conditionalRules, projectRoot } = await loadServerHierarchicalMemory(this.getWorkingDir(), this.getMemoryDiscoveryDirectories(), this.getFileService(), this.getExtensionContextFilePaths(), this.isTrustedFolder(), this.getImportFormat(), this.contextRuleExcludes, { explicitOnly: this.getBareMode() });
        if (this.getManagedAutoMemoryEnabled()) {
            const managedAutoMemoryIndex = await readAutoMemoryIndex(this.getProjectRoot());
            this.setUserMemory(this.memoryManager.appendToUserMemory(memoryContent, getAutoMemoryRoot(this.getProjectRoot()), managedAutoMemoryIndex));
        }
        else {
            this.setUserMemory(memoryContent);
        }
        this.setGeminiMdFileCount(fileCount);
        this.conditionalRulesRegistry = new ConditionalRulesRegistry(conditionalRules, projectRoot);
    }
    getMemoryDiscoveryDirectories() {
        if (!this.shouldLoadMemoryFromIncludeDirectories()) {
            return [];
        }
        if (this.getBareMode()) {
            return this.explicitIncludeDirectories;
        }
        return [...this.getWorkspaceContext().getDirectories()];
    }
    getConditionalRulesRegistry() {
        return this.conditionalRulesRegistry;
    }
    /**
     * Update the conditional rules registry. Called after external refresh
     * paths (e.g. /memory refresh or /directory add) that bypass
     * refreshHierarchicalMemory().
     */
    setConditionalRulesRegistry(registry) {
        this.conditionalRulesRegistry = registry;
    }
    getContextRuleExcludes() {
        return this.contextRuleExcludes;
    }
    getContentGenerator() {
        return this.contentGenerator;
    }
    /**
     * Get the ModelsConfig instance for model-related operations.
     * External code (e.g., CLI) can use this to access model configuration.
     */
    getModelsConfig() {
        return this.modelsConfig;
    }
    /**
     * Updates the credentials in the generation config.
     * Exclusive for `OpenAIKeyPrompt` to update credentials via `/auth`
     * Delegates to ModelsConfig.
     */
    updateCredentials(credentials, settingsGenerationConfig) {
        this.modelsConfig.updateCredentials(credentials, settingsGenerationConfig);
    }
    /**
     * Reload model providers configuration at runtime.
     * This enables hot-reloading of modelProviders settings without restarting the CLI.
     * Should be called before refreshAuth when settings.json has been updated.
     *
     * @param modelProvidersConfig - The updated model providers configuration
     */
    reloadModelProvidersConfig(modelProvidersConfig) {
        this.modelsConfig.reloadModelProvidersConfig(modelProvidersConfig);
    }
    /**
     * Refresh authentication and rebuild ContentGenerator.
     */
    async refreshAuth(authMethod, isInitialAuth) {
        // Sync modelsConfig state for this auth refresh
        const modelId = this.modelsConfig.getModel();
        this.modelsConfig.syncAfterAuthRefresh(authMethod, modelId);
        // Check and consume cached credentials flag
        const requireCached = this.modelsConfig.consumeRequireCachedCredentialsFlag();
        const { config, sources } = resolveContentGeneratorConfigWithSources(this, authMethod, this.modelsConfig.getGenerationConfig(), this.modelsConfig.getGenerationConfigSources(), {
            strictModelProvider: this.modelsConfig.isStrictModelProviderSelection(),
        });
        const newContentGeneratorConfig = config;
        this.contentGenerator = await createContentGenerator(newContentGeneratorConfig, this, requireCached ? true : isInitialAuth);
        // Only assign to instance properties after successful initialization
        this.contentGeneratorConfig = newContentGeneratorConfig;
        this.contentGeneratorConfigSources = sources;
        // Initialize BaseLlmClient now that the ContentGenerator is available
        this.baseLlmClient = new BaseLlmClient(this.contentGenerator, this);
        // Fire auth_success notification hook (supports both interactive & non-interactive)
        const messageBus = this.getMessageBus();
        const hooksEnabled = !this.getDisableAllHooks();
        if (hooksEnabled && messageBus) {
            fireNotificationHook(messageBus, `Successfully authenticated with ${authMethod}`, NotificationType.AuthSuccess, 'Authentication successful').catch(() => {
                // Silently ignore errors - fireNotificationHook has internal error handling
                // and notification hooks should not block the auth flow
            });
        }
    }
    /**
     * Provides access to the BaseLlmClient for stateless LLM operations.
     */
    getBaseLlmClient() {
        if (!this.baseLlmClient) {
            // Handle cases where initialization might be deferred or authentication failed
            if (this.contentGenerator) {
                this.baseLlmClient = new BaseLlmClient(this.getContentGenerator(), this);
            }
            else {
                throw new Error('BaseLlmClient not initialized. Ensure authentication has occurred and ContentGenerator is ready.');
            }
        }
        return this.baseLlmClient;
    }
    getSessionId() {
        return this.sessionId;
    }
    /**
     * Returns warnings generated during configuration resolution.
     * These warnings are collected from model configuration resolution
     * and should be displayed to the user during startup.
     */
    getWarnings() {
        return this.warnings;
    }
    getDebugLogger() {
        return this.debugLogger;
    }
    /**
     * Starts a new session and resets session-scoped services.
     */
    startNewSession(sessionId, sessionData) {
        // Finalize the outgoing session before switching.
        try {
            this.chatRecordingService?.finalize();
        }
        catch {
            // Best-effort — don't block session switch
        }
        this.sessionId = sessionId ?? randomUUID();
        this.sessionData = sessionData;
        setDebugLogSession(this);
        this.debugLogger = createDebugLogger();
        this.chatRecordingService = this.chatRecordingEnabled
            ? new ChatRecordingService(this)
            : undefined;
        // The file-read cache is session-scoped: its `file_unchanged`
        // placeholder relies on the model having seen the prior full read
        // earlier in the *current* conversation. Carrying entries across
        // /clear or session resume would let a follow-up Read return the
        // placeholder despite the new session never having received the
        // file contents. Use the getter so the lazy own-property
        // initialization in getFileReadCache() applies even for Configs
        // constructed via Object.create — those should clear their own
        // cache, not the parent's.
        this.getFileReadCache().clear();
        if (this.initialized) {
            logStartSession(this, new StartSessionEvent(this));
        }
        return this.sessionId;
    }
    /**
     * Returns the resumed session data if this session was resumed from a previous one.
     */
    getResumedSessionData() {
        return this.sessionData;
    }
    shouldLoadMemoryFromIncludeDirectories() {
        return this.loadMemoryFromIncludeDirectories;
    }
    getImportFormat() {
        return this.importFormat;
    }
    getContentGeneratorConfig() {
        return this.contentGeneratorConfig;
    }
    getContentGeneratorConfigSources() {
        // If contentGeneratorConfigSources is empty (before initializeAuth),
        // get sources from ModelsConfig
        if (Object.keys(this.contentGeneratorConfigSources).length === 0 &&
            this.modelsConfig) {
            return this.modelsConfig.getGenerationConfigSources();
        }
        return this.contentGeneratorConfigSources;
    }
    getModel() {
        return this.contentGeneratorConfig?.model || this.modelsConfig.getModel();
    }
    onModelChange(listener) {
        this.modelChangeListeners.add(listener);
        return () => {
            this.modelChangeListeners.delete(listener);
        };
    }
    notifyModelChangeListeners() {
        const model = this.getModel();
        for (const listener of this.modelChangeListeners) {
            listener(model);
        }
    }
    /**
     * Returns the fast model if one is configured and valid for the current auth type,
     * otherwise returns undefined. Background agents (memory extraction, dream, /btw)
     * use this as a cheaper alternative to the main session model.
     */
    getFastModel() {
        if (!this.fastModel)
            return undefined;
        const authType = this.contentGeneratorConfig?.authType;
        if (!authType)
            return undefined;
        const available = this.getAvailableModelsForAuthType(authType);
        return available.some((m) => m.id === this.fastModel)
            ? this.fastModel
            : undefined;
    }
    /**
     * Update the fast model at runtime (e.g., when the user runs `/model --fast <model>`).
     * Pass undefined or an empty string to clear the fast model override.
     */
    setFastModel(model) {
        this.fastModel = model || undefined;
    }
    /**
     * Set model programmatically (e.g., VLM auto-switch, fallback).
     * Delegates to ModelsConfig.
     */
    async setModel(newModel, metadata) {
        await this.modelsConfig.setModel(newModel, metadata);
        // Also update contentGeneratorConfig for hot-update compatibility
        if (this.contentGeneratorConfig) {
            this.contentGeneratorConfig.model = newModel;
        }
        this.notifyModelChangeListeners();
    }
    /**
     * Handle model change from ModelsConfig.
     * This updates the content generator config with the new model settings.
     */
    async handleModelChange(authType, requiresRefresh) {
        if (!this.contentGeneratorConfig) {
            return;
        }
        // Keep full history (including thought parts) on model switch.
        // Some OpenAI-compatible reasoning models (e.g. DeepSeek) require
        // reasoning_content to be preserved across turns.
        // Hot update path: only supported for vivekmind-oauth.
        // For other auth types we always refresh to recreate the ContentGenerator.
        //
        // Rationale:
        // - Non-qwen providers may need to re-validate credentials / baseUrl / envKey.
        // - ModelsConfig.applyResolvedModelDefaults can clear or change credentials sources.
        // - Refresh keeps runtime behavior consistent and centralized.
        if (authType === AuthType.VIVEKMIND_OAUTH && !requiresRefresh) {
            const { config, sources } = resolveContentGeneratorConfigWithSources(this, authType, this.modelsConfig.getGenerationConfig(), this.modelsConfig.getGenerationConfigSources(), {
                strictModelProvider: this.modelsConfig.isStrictModelProviderSelection(),
            });
            // Hot-update fields (vivekmind-oauth models share the same auth + client).
            this.contentGeneratorConfig.model = config.model;
            this.contentGeneratorConfig.samplingParams = config.samplingParams;
            this.contentGeneratorConfig.contextWindowSize = config.contextWindowSize;
            this.contentGeneratorConfig.enableCacheControl =
                config.enableCacheControl;
            this.contentGeneratorConfig.splitToolMedia = config.splitToolMedia;
            if ('model' in sources) {
                this.contentGeneratorConfigSources['model'] = sources['model'];
            }
            if ('samplingParams' in sources) {
                this.contentGeneratorConfigSources['samplingParams'] =
                    sources['samplingParams'];
            }
            if ('enableCacheControl' in sources) {
                this.contentGeneratorConfigSources['enableCacheControl'] =
                    sources['enableCacheControl'];
            }
            if ('contextWindowSize' in sources) {
                this.contentGeneratorConfigSources['contextWindowSize'] =
                    sources['contextWindowSize'];
            }
            if ('splitToolMedia' in sources) {
                this.contentGeneratorConfigSources['splitToolMedia'] =
                    sources['splitToolMedia'];
            }
            return;
        }
        // Full refresh path
        await this.refreshAuth(authType);
    }
    /**
     * Get available models for the current authType.
     * Delegates to ModelsConfig.
     */
    getAvailableModels() {
        return this.modelsConfig.getAvailableModels();
    }
    /**
     * Get available models for a specific authType.
     * Delegates to ModelsConfig.
     */
    getAvailableModelsForAuthType(authType) {
        return this.modelsConfig.getAvailableModelsForAuthType(authType);
    }
    /**
     * Get all configured models across authTypes.
     * Delegates to ModelsConfig.
     */
    getAllConfiguredModels(authTypes) {
        return this.modelsConfig.getAllConfiguredModels(authTypes);
    }
    /**
     * Get the currently active runtime model snapshot.
     * Delegates to ModelsConfig.
     */
    getActiveRuntimeModelSnapshot() {
        return this.modelsConfig.getActiveRuntimeModelSnapshot();
    }
    /**
     * Switch authType+model.
     * Supports both registry-backed models and runtime model snapshots.
     *
     * For runtime models, the modelId should be in format `$runtime|${authType}|${modelId}`.
     * This triggers a refresh of the ContentGenerator when required (always on authType changes).
     * For vivekmind-oauth model switches that are hot-update safe, this may update in place.
     *
     * @param authType - Target authentication type
     * @param modelId - Target model ID (or `$runtime|${authType}|${modelId}` for runtime models)
     * @param options - Additional options like requireCachedCredentials
     */
    /**
     * Discover models for dynamic providers
     */
    async discoverModels(authType) {
        await this.modelsConfig.discoverModels(authType);
    }
    async switchModel(authType, modelId, options) {
        await this.modelsConfig.switchModel(authType, modelId, options);
        this.notifyModelChangeListeners();
    }
    getMaxSessionTurns() {
        return this.maxSessionTurns;
    }
    getClearContextOnIdle() {
        return this.clearContextOnIdle;
    }
    getSessionTokenLimit() {
        return this.sessionTokenLimit;
    }
    getEmbeddingModel() {
        return this.embeddingModel;
    }
    getSandbox() {
        return this.sandbox;
    }
    isRestrictiveSandbox() {
        const sandboxConfig = this.getSandbox();
        const seatbeltProfile = process.env['SEATBELT_PROFILE'];
        return (!!sandboxConfig &&
            sandboxConfig.command === 'sandbox-exec' &&
            !!seatbeltProfile &&
            seatbeltProfile.startsWith('restrictive-'));
    }
    getTargetDir() {
        return this.targetDir;
    }
    getProjectRoot() {
        return this.targetDir;
    }
    getCwd() {
        return this.targetDir;
    }
    getWorkspaceContext() {
        return this.workspaceContext;
    }
    getToolRegistry() {
        return this.toolRegistry;
    }
    /**
     * Shuts down the Config and releases all resources.
     * This method is idempotent and safe to call multiple times.
     * It handles the case where initialization was not completed.
     */
    async shutdown() {
        try {
            if (!this.initialized) {
                // Nothing else to clean up if not initialized.
                return;
            }
            // Finalize the current session's metadata before cleanup, then drain
            // the async write queue so no records are lost on exit.
            try {
                this.chatRecordingService?.finalize();
                await this.chatRecordingService?.flush();
            }
            catch {
                // Best-effort — don't block shutdown
            }
            this.skillManager?.stopWatching();
            if (this.toolRegistry) {
                await this.toolRegistry.stop();
            }
            this.backgroundTaskRegistry.abortAll();
            this.monitorRegistry.abortAll({ notify: false });
            this.backgroundShellRegistry.abortAll();
            await this.cleanupArenaRuntime();
        }
        catch (error) {
            // Log but don't throw - cleanup should be best-effort
            this.debugLogger.error('Error during Config shutdown:', error);
        }
        finally {
            if (isTelemetrySdkInitialized()) {
                await shutdownTelemetry();
            }
        }
    }
    getPromptRegistry() {
        return this.promptRegistry;
    }
    getDebugMode() {
        return this.debugMode;
    }
    getQuestion() {
        return this.question;
    }
    getSystemPrompt() {
        return this.systemPrompt;
    }
    getAppendSystemPrompt() {
        return this.appendSystemPrompt;
    }
    /** @deprecated Use getPermissionsAllow() instead. */
    getCoreTools() {
        if (this.getBareMode()) {
            return DEFAULT_BARE_CORE_TOOLS;
        }
        return this.coreTools;
    }
    /**
     * Returns the merged allow-rules for PermissionManager.
     *
     * This merges all sources so that PermissionManager receives a single,
     * authoritative list:
     *   - settings.permissions.allow  (persistent rules from all scopes)
     *   - allowedTools param  (SDK / argv auto-approve list)
     *
     * Note: coreTools is intentionally excluded here — it has whitelist semantics
     * (only listed tools are registered), not auto-approve semantics. It is
     * handled separately via PermissionManager.coreToolsAllowList.
     *
     * CLI callers (loadCliConfig) already pre-merge argv into permissionsAllow
     * before constructing Config, so those fields will be empty for CLI usage.
     * SDK callers construct Config directly and rely on allowedTools.
     */
    getPermissionsAllow() {
        const base = this.permissionsAllow ?? [];
        const sdkAllow = [...(this.allowedTools ?? [])];
        if (sdkAllow.length === 0)
            return base.length > 0 ? base : [];
        const merged = [...base];
        for (const t of sdkAllow) {
            if (t && !merged.includes(t))
                merged.push(t);
        }
        return merged;
    }
    getPermissionsAsk() {
        return this.permissionsAsk;
    }
    /**
     * Returns the merged deny-rules for PermissionManager.
     *
     * Merges:
     *   - settings.permissions.deny  (persistent rules from all scopes)
     *   - excludeTools param  (SDK / argv blocklist)
     *
     * CLI callers pre-merge argv.excludeTools into permissionsDeny.
     */
    getPermissionsDeny() {
        const base = this.permissionsDeny ?? [];
        const sdkDeny = this.excludeTools ?? [];
        if (sdkDeny.length === 0)
            return base.length > 0 ? base : [];
        const merged = [...base];
        for (const t of sdkDeny) {
            if (t && !merged.includes(t))
                merged.push(t);
        }
        return merged;
    }
    getToolDiscoveryCommand() {
        return this.toolDiscoveryCommand;
    }
    /**
     * Returns the pre-merged list of slash command names that should be hidden
     * from the CLI surface. Callers should treat this as a case-insensitive
     * denylist; `CommandService.create` handles the normalization.
     */
    getDisabledSlashCommands() {
        return this.disabledSlashCommands;
    }
    getToolCallCommand() {
        return this.toolCallCommand;
    }
    getMcpServerCommand() {
        return this.mcpServerCommand;
    }
    getMcpServers() {
        let mcpServers = { ...(this.mcpServers || {}) };
        const extensions = this.getActiveExtensions();
        for (const extension of extensions) {
            Object.entries(extension.config.mcpServers || {}).forEach(([key, server]) => {
                if (mcpServers[key])
                    return;
                mcpServers[key] = {
                    ...server,
                    extensionName: extension.config.name,
                };
            });
        }
        if (this.allowedMcpServers) {
            mcpServers = Object.fromEntries(Object.entries(mcpServers).filter(([key]) => this.allowedMcpServers?.includes(key)));
        }
        // Note: We no longer filter out excluded servers here.
        // The UI layer should check isMcpServerDisabled() to determine
        // whether to show a server as disabled.
        return mcpServers;
    }
    getExcludedMcpServers() {
        return this.excludedMcpServers;
    }
    setExcludedMcpServers(excluded) {
        this.excludedMcpServers = excluded;
    }
    isMcpServerDisabled(serverName) {
        return this.excludedMcpServers?.includes(serverName) ?? false;
    }
    addMcpServers(servers) {
        if (this.initialized) {
            throw new Error('Cannot modify mcpServers after initialization');
        }
        this.mcpServers = { ...this.mcpServers, ...servers };
    }
    isLspEnabled() {
        return this.lspEnabled && !this.getBareMode();
    }
    getLspClient() {
        return this.lspClient;
    }
    /**
     * Allows wiring an LSP client after Config construction but before initialize().
     */
    setLspClient(client) {
        if (this.initialized) {
            throw new Error('Cannot set LSP client after initialization');
        }
        this.lspClient = client;
    }
    getSessionSubagents() {
        return this.sessionSubagents;
    }
    setSessionSubagents(subagents) {
        if (this.initialized) {
            throw new Error('Cannot modify sessionSubagents after initialization');
        }
        this.sessionSubagents = subagents;
    }
    getSdkMode() {
        return this.sdkMode;
    }
    setSdkMode(value) {
        this.sdkMode = value;
    }
    getUserMemory() {
        return this.userMemory;
    }
    setUserMemory(newUserMemory) {
        this.userMemory = newUserMemory;
    }
    getGeminiMdFileCount() {
        return this.geminiMdFileCount;
    }
    setGeminiMdFileCount(count) {
        this.geminiMdFileCount = count;
    }
    getArenaManager() {
        return this.arenaManager;
    }
    setArenaManager(manager) {
        this.arenaManager = manager;
        this.arenaManagerChangeCallback?.(manager);
    }
    /**
     * Register a callback invoked whenever the arena manager changes.
     * Pass `null` to unsubscribe. Only one subscriber is supported.
     */
    onArenaManagerChange(cb) {
        this.arenaManagerChangeCallback = cb;
    }
    getArenaAgentClient() {
        return this.arenaAgentClient;
    }
    getAgentsSettings() {
        return this.agentsSettings;
    }
    /**
     * Clean up Arena runtime. When `force` is true (e.g., /arena select --discard),
     * always removes worktrees regardless of preserveArtifacts.
     */
    async cleanupArenaRuntime(force) {
        const manager = this.arenaManager;
        if (!manager) {
            return;
        }
        if (!force && this.agentsSettings.arena?.preserveArtifacts) {
            await manager.cleanupRuntime();
        }
        else {
            await manager.cleanup();
        }
        this.setArenaManager(null);
    }
    getApprovalMode() {
        return this.approvalMode;
    }
    /**
     * Returns the approval mode that was active before entering plan mode.
     * Falls back to DEFAULT if no pre-plan mode was recorded.
     */
    getPrePlanMode() {
        return this.prePlanMode ?? ApprovalMode.DEFAULT;
    }
    setApprovalMode(mode) {
        if (!this.isTrustedFolder() &&
            mode !== ApprovalMode.DEFAULT &&
            mode !== ApprovalMode.PLAN) {
            throw new Error('Cannot enable privileged approval modes in an untrusted folder.');
        }
        // Track the mode before entering plan mode so it can be restored later
        if (mode === ApprovalMode.PLAN && this.approvalMode !== ApprovalMode.PLAN) {
            this.prePlanMode = this.approvalMode;
        }
        else if (mode !== ApprovalMode.PLAN &&
            this.approvalMode === ApprovalMode.PLAN) {
            this.prePlanMode = undefined;
        }
        this.approvalMode = mode;
    }
    /**
     * Returns the file path for this session's plan file.
     */
    getPlanFilePath() {
        return Storage.getPlanFilePath(this.sessionId);
    }
    /**
     * Saves a plan to disk for the current session.
     */
    savePlan(plan) {
        const filePath = this.getPlanFilePath();
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, plan, 'utf-8');
    }
    /**
     * Loads the plan for the current session, or returns undefined if none exists.
     */
    loadPlan() {
        const filePath = this.getPlanFilePath();
        try {
            return fs.readFileSync(filePath, 'utf-8');
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'ENOENT') {
                return undefined;
            }
            throw error;
        }
    }
    getInputFormat() {
        return this.inputFormat;
    }
    getIncludePartialMessages() {
        return this.includePartialMessages;
    }
    getAccessibility() {
        return this.accessibility;
    }
    getTelemetryEnabled() {
        return this.telemetrySettings.enabled ?? false;
    }
    getTelemetryLogPromptsEnabled() {
        return this.telemetrySettings.logPrompts ?? true;
    }
    getTelemetryOtlpEndpoint() {
        return this.telemetrySettings.otlpEndpoint ?? DEFAULT_OTLP_ENDPOINT;
    }
    getTelemetryOtlpProtocol() {
        return this.telemetrySettings.otlpProtocol ?? 'grpc';
    }
    getTelemetryOtlpTracesEndpoint() {
        return this.telemetrySettings.otlpTracesEndpoint;
    }
    getTelemetryOtlpLogsEndpoint() {
        return this.telemetrySettings.otlpLogsEndpoint;
    }
    getTelemetryOtlpMetricsEndpoint() {
        return this.telemetrySettings.otlpMetricsEndpoint;
    }
    getTelemetryTarget() {
        return this.telemetrySettings.target ?? DEFAULT_TELEMETRY_TARGET;
    }
    getTelemetryOutfile() {
        return this.telemetrySettings.outfile;
    }
    getGitCoAuthor() {
        return this.gitCoAuthor;
    }
    getTelemetryUseCollector() {
        return this.telemetrySettings.useCollector ?? false;
    }
    getGeminiClient() {
        return this.geminiClient;
    }
    getCronScheduler() {
        if (!this.cronScheduler) {
            this.cronScheduler = new CronScheduler();
        }
        return this.cronScheduler;
    }
    isCronEnabled() {
        // Cron is experimental and opt-in: enabled via settings or env var
        if (process.env['VIVEKMIND_CODE_ENABLE_CRON'] === '1')
            return true;
        return this.cronEnabled;
    }
    /**
     * Whether the turn loop should fire a fast-model call after each tool batch
     * to emit a `tool_use_summary` message. Mirrors Claude Code's
     * `CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES` gate, but defaults to on so the
     * compact-mode UI benefits without configuration.
     *
     * Env overrides (either direction): `VIVEKMIND_CODE_EMIT_TOOL_USE_SUMMARIES=0`
     * to force off, `=1` to force on.
     */
    getEmitToolUseSummaries() {
        const env = process.env['VIVEKMIND_CODE_EMIT_TOOL_USE_SUMMARIES'];
        if (env === '0' || env === 'false')
            return false;
        if (env === '1' || env === 'true')
            return true;
        return this.emitToolUseSummaries;
    }
    getEnableRecursiveFileSearch() {
        return this.fileFiltering.enableRecursiveFileSearch;
    }
    getFileFilteringEnableFuzzySearch() {
        return this.fileFiltering.enableFuzzySearch;
    }
    getFileFilteringRespectGitIgnore() {
        return this.fileFiltering.respectGitIgnore;
    }
    getFileFilteringRespectVivekMindIgnore() {
        return this.fileFiltering.respectVivekMindIgnore;
    }
    getFileFilteringOptions() {
        return {
            respectGitIgnore: this.fileFiltering.respectGitIgnore,
            respectVivekMindIgnore: this.fileFiltering.respectVivekMindIgnore,
        };
    }
    /**
     * Gets custom file exclusion patterns from configuration.
     * TODO: This is a placeholder implementation. In the future, this could
     * read from settings files, CLI arguments, or environment variables.
     */
    getCustomExcludes() {
        // Placeholder implementation - returns empty array for now
        // Future implementation could read from:
        // - User settings file
        // - Project-specific configuration
        // - Environment variables
        // - CLI arguments
        return [];
    }
    getCheckpointingEnabled() {
        return this.checkpointing;
    }
    getProxy() {
        return normalizeProxyUrl(this.proxy);
    }
    getWorkingDir() {
        return this.cwd;
    }
    getBugCommand() {
        return this.bugCommand;
    }
    getFileService() {
        if (!this.fileDiscoveryService) {
            this.fileDiscoveryService = new FileDiscoveryService(this.targetDir);
        }
        return this.fileDiscoveryService;
    }
    getUsageStatisticsEnabled() {
        return this.usageStatisticsEnabled;
    }
    getExtensionContextFilePaths() {
        const extensionContextFilePaths = this.getActiveExtensions().flatMap((e) => e.contextFiles);
        return [
            ...extensionContextFilePaths,
            ...(this.outputLanguageFilePath ? [this.outputLanguageFilePath] : []),
        ];
    }
    getExperimentalZedIntegration() {
        return this.experimentalZedIntegration;
    }
    getListExtensions() {
        return this.listExtensions;
    }
    getExtensionManager() {
        return this.extensionManager;
    }
    /**
     * Get the hook system instance if hooks are enabled.
     * Returns undefined if hooks are not enabled.
     */
    getHookSystem() {
        return this.hookSystem;
    }
    /**
     * Fast-path check: returns true only when hooks are enabled AND there are
     * registered hooks for the given event name.  Callers can use this to skip
     * expensive MessageBus round-trips when no hooks are configured.
     */
    hasHooksForEvent(eventName) {
        return this.hookSystem?.hasHooksForEvent(eventName) ?? false;
    }
    /**
     * Check if all hooks are disabled.
     */
    getDisableAllHooks() {
        return this.disableAllHooks || this.getBareMode();
    }
    getManagedAutoMemoryEnabled() {
        return this.enableManagedAutoMemory && !this.getBareMode();
    }
    getManagedAutoDreamEnabled() {
        return this.enableManagedAutoDream && !this.getBareMode();
    }
    /**
     * Return the MemoryManager instance created for this Config.
     * Use this to share background-task state (registry, drainer) with memory
     * module runtimes (extract, dream) instead of relying on module-level
     * globals.
     */
    getMemoryManager() {
        return this.memoryManager;
    }
    /**
     * Get the message bus instance.
     * Returns undefined if not set.
     */
    getMessageBus() {
        return this.messageBus;
    }
    /**
     * Set the message bus instance.
     * This is called by the CLI layer to inject the MessageBus.
     */
    setMessageBus(messageBus) {
        this.messageBus = messageBus;
    }
    /**
     * Get project-level hooks configuration.
     * Returns hooks from workspace settings, only in trusted folders.
     * Used by HookRegistry to load project-specific hooks with proper source attribution.
     */
    getProjectHooks() {
        if (this.getBareMode()) {
            return undefined;
        }
        // Only return project hooks if workspace is trusted
        if (!this.isTrustedFolder()) {
            return undefined;
        }
        // Prefer new projectHooks field, fall back to hooks for backward compatibility
        const hooks = this.projectHooks ?? this.hooks;
        return hooks;
    }
    /**
     * Get user-level hooks configuration.
     * Returns hooks from user settings, always available regardless of folder trust.
     * Used by HookRegistry to load user-specific hooks with proper source attribution.
     */
    getUserHooks() {
        if (this.getBareMode()) {
            return undefined;
        }
        // Prefer new userHooks field, fall back to hooks for backward compatibility
        const hooks = this.userHooks ?? this.hooks;
        return hooks;
    }
    getExtensions() {
        const extensions = this.extensionManager.getLoadedExtensions();
        if (this.overrideExtensions) {
            const overrideExtensionNames = new Set(this.overrideExtensions.map((name) => name.toLowerCase()));
            return extensions.filter((e) => overrideExtensionNames.has(e.name.toLowerCase()));
        }
        else {
            return extensions;
        }
    }
    getExplicitExtensionNames() {
        return (this.overrideExtensions ?? []).filter((name) => name.trim() !== '' && name.toLowerCase() !== 'none');
    }
    getActiveExtensions() {
        return this.getExtensions().filter((e) => e.isActive);
    }
    getBlockedMcpServers() {
        const mcpServers = { ...(this.mcpServers || {}) };
        const extensions = this.getActiveExtensions();
        for (const extension of extensions) {
            Object.entries(extension.config.mcpServers || {}).forEach(([key, server]) => {
                if (mcpServers[key])
                    return;
                mcpServers[key] = {
                    ...server,
                    extensionName: extension.config.name,
                };
            });
        }
        const blockedMcpServers = [];
        if (this.allowedMcpServers) {
            Object.entries(mcpServers).forEach(([key, server]) => {
                const isAllowed = this.allowedMcpServers?.includes(key);
                if (!isAllowed) {
                    blockedMcpServers.push({
                        name: key,
                        extensionName: server.extensionName || '',
                    });
                }
            });
        }
        return blockedMcpServers;
    }
    getNoBrowser() {
        return this.noBrowser;
    }
    isBrowserLaunchSuppressed() {
        return this.getNoBrowser() || !shouldAttemptBrowserLaunch();
    }
    getIdeMode() {
        return this.ideMode;
    }
    getFolderTrustFeature() {
        return this.folderTrustFeature;
    }
    /**
     * Returns 'true' if the workspace is considered "trusted".
     * 'false' for untrusted.
     */
    getFolderTrust() {
        return this.folderTrust;
    }
    /**
     * Returns the whitelist of allowed HTTP hook URL patterns.
     * If empty, all URLs are allowed (subject to SSRF protection).
     */
    getAllowedHttpHookUrls() {
        return this.getBareMode() ? [] : this.allowedHttpHookUrls;
    }
    isTrustedFolder() {
        // isWorkspaceTrusted in cli/src/config/trustedFolder.js returns undefined
        // when the file based trust value is unavailable, since it is mainly used
        // in the initialization for trust dialogs, etc. Here we return true since
        // config.isTrustedFolder() is used for the main business logic of blocking
        // tool calls etc in the rest of the application.
        //
        // Default value is true since we load with trusted settings to avoid
        // restarts in the more common path. If the user chooses to mark the folder
        // as untrusted, the CLI will restart and we will have the trust value
        // reloaded.
        const context = ideContextStore.get();
        if (context?.workspaceState?.isTrusted !== undefined) {
            return context.workspaceState.isTrusted;
        }
        return this.trustedFolder ?? true;
    }
    setIdeMode(value) {
        this.ideMode = value;
    }
    getAuthType() {
        return this.contentGeneratorConfig?.authType;
    }
    getCliVersion() {
        return this.cliVersion;
    }
    getChannel() {
        return this.channel;
    }
    /**
     * Get the file descriptor for dual output JSON event stream.
     * When set, the TUI mode will also emit structured JSON events to this fd.
     */
    getJsonFd() {
        return this.jsonFd;
    }
    /**
     * Get the file path for dual output JSON event stream.
     * When set, the TUI mode will also emit structured JSON events to this file.
     */
    getJsonFile() {
        return this.jsonFile;
    }
    /**
     * Get the file path for remote input commands (bidirectional sync).
     * When set, the TUI mode will watch this file for JSONL commands written
     * by an external process and submit them as user messages.
     */
    getInputFile() {
        return this.inputFile;
    }
    /**
     * Get the default file encoding for new files.
     * @returns FileEncodingType
     */
    getDefaultFileEncoding() {
        return this.defaultFileEncoding;
    }
    /**
     * Get the current FileSystemService
     */
    getFileSystemService() {
        return this.fileSystemService;
    }
    /**
     * Set a custom FileSystemService
     */
    setFileSystemService(fileSystemService) {
        this.fileSystemService = fileSystemService;
    }
    getChatCompression() {
        return this.chatCompression;
    }
    isInteractive() {
        return this.interactive;
    }
    getUseRipgrep() {
        return this.useRipgrep;
    }
    getUseBuiltinRipgrep() {
        return this.useBuiltinRipgrep;
    }
    getShouldUseNodePtyShell() {
        return this.shouldUseNodePtyShell;
    }
    getSkipNextSpeakerCheck() {
        return this.skipNextSpeakerCheck;
    }
    getShellExecutionConfig() {
        return this.shellExecutionConfig;
    }
    setShellExecutionConfig(config) {
        this.shellExecutionConfig = {
            terminalWidth: config.terminalWidth ?? this.shellExecutionConfig.terminalWidth,
            terminalHeight: config.terminalHeight ?? this.shellExecutionConfig.terminalHeight,
            showColor: config.showColor ?? this.shellExecutionConfig.showColor,
            pager: config.pager ?? this.shellExecutionConfig.pager,
        };
    }
    getScreenReader() {
        return this.accessibility.screenReader ?? false;
    }
    getSkipLoopDetection() {
        return this.skipLoopDetection;
    }
    getSkipStartupContext() {
        return this.skipStartupContext;
    }
    getBareMode() {
        return this.bareMode;
    }
    getTruncateToolOutputThreshold() {
        if (this.truncateToolOutputThreshold <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        return this.truncateToolOutputThreshold;
    }
    getTruncateToolOutputLines() {
        if (this.truncateToolOutputLines <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        return this.truncateToolOutputLines;
    }
    getOutputFormat() {
        return this.outputFormat;
    }
    async getGitService() {
        if (!this.gitService) {
            this.gitService = new GitService(this.targetDir, this.storage);
            await this.gitService.initialize();
        }
        return this.gitService;
    }
    /**
     * Returns the chat recording service.
     */
    getChatRecordingService() {
        if (!this.chatRecordingEnabled) {
            return undefined;
        }
        if (!this.chatRecordingService) {
            this.chatRecordingService = new ChatRecordingService(this);
        }
        return this.chatRecordingService;
    }
    /**
     * Returns the transcript file path for the current session.
     * This is the path to the JSONL file where the conversation is recorded.
     * Returns empty string if chat recording is disabled.
     */
    getTranscriptPath() {
        if (!this.chatRecordingEnabled) {
            return '';
        }
        const projectDir = this.storage.getProjectDir();
        const sessionId = this.getSessionId();
        const safeFilename = `${sessionId}.jsonl`;
        return path.join(projectDir, 'chats', safeFilename);
    }
    /**
     * Gets or creates a SessionService for managing chat sessions.
     */
    getSessionService() {
        if (!this.sessionService) {
            this.sessionService = new SessionService(this.targetDir);
        }
        return this.sessionService;
    }
    getFileExclusions() {
        return this.fileExclusions;
    }
    getSubagentManager() {
        return this.subagentManager;
    }
    getBackgroundTaskRegistry() {
        return this.backgroundTaskRegistry;
    }
    getMonitorRegistry() {
        return this.monitorRegistry;
    }
    getBackgroundAgentResumeService() {
        if (!this.backgroundAgentResumeService) {
            this.backgroundAgentResumeService = new BackgroundAgentResumeService(this);
        }
        return this.backgroundAgentResumeService;
    }
    async loadPausedBackgroundAgents(sessionId = this.getSessionId()) {
        return this.getBackgroundAgentResumeService().loadPausedBackgroundAgents(sessionId);
    }
    async resumeBackgroundAgent(agentId, initialMessage) {
        return this.getBackgroundAgentResumeService().resumeBackgroundAgent(agentId, initialMessage);
    }
    abandonBackgroundAgent(agentId) {
        return this.getBackgroundAgentResumeService().abandonBackgroundAgent(agentId);
    }
    getBackgroundShellRegistry() {
        return this.backgroundShellRegistry;
    }
    /**
     * Session-scoped cache that tracks Read / Edit / WriteFile operations
     * on files. The cache must be **per-Config-instance** so that each
     * subagent (which gets its own Config) does not inherit the parent's
     * recorded reads via the prototype chain.
     *
     * The wrinkle: every subagent / scoped-agent / fork path in this
     * codebase constructs its Config via `Object.create(parent)`. That
     * does **not** run instance field initializers, so the parent's
     * `fileReadCache` field is reachable on the child only by prototype
     * lookup — i.e. child and parent end up sharing the same cache. The
     * own-property check below detects "this instance was made by
     * Object.create" and lazily attaches a fresh cache, ensuring
     * isolation without requiring every Object.create site to remember
     * to override the field.
     */
    getFileReadCache() {
        if (!Object.prototype.hasOwnProperty.call(this, 'fileReadCache')) {
            // The own-property write needs to bypass `private`'s structural
            // check — the field is conceptually still private to the class,
            // we just need TS to let us install an own copy on a child
            // instance produced by `Object.create(parent)`.
            this.fileReadCache =
                new FileReadCache();
        }
        return this.fileReadCache;
    }
    /**
     * When true, ReadFile / Edit / WriteFile must bypass the session
     * FileReadCache entirely and behave as if it did not exist (no
     * `file_unchanged` placeholder, no future prior-read enforcement).
     * Intended as an escape hatch for sessions where the cache's "model
     * has already seen this content earlier in the conversation"
     * assumption is unreliable — e.g. after context compaction or
     * transcript transformation.
     */
    getFileReadCacheDisabled() {
        return this.fileReadCacheDisabled;
    }
    /**
     * Whether interactive permission prompts should be auto-denied.
     * True for background agents that have no UI to show prompts.
     * PermissionRequest hooks still run and can override the denial.
     */
    getShouldAvoidPermissionPrompts() {
        return false;
    }
    getSkillManager() {
        return this.skillManager;
    }
    /**
     * Registers a provider that returns model-invocable commands (e.g., bundled
     * skills, user/project file commands, MCP prompts). Called by the CLI's
     * CommandService after initialisation so that SkillTool can merge these into
     * its tool description.
     */
    setModelInvocableCommandsProvider(provider) {
        this.modelInvocableCommandsProvider = provider;
    }
    /**
     * Returns the registered model-invocable commands provider, or null if none
     * has been registered (e.g., in SDK mode).
     */
    getModelInvocableCommandsProvider() {
        return this.modelInvocableCommandsProvider;
    }
    /**
     * Registers an executor that can invoke a model-invocable command by name
     * (e.g., MCP prompts). Returns the prompt content as a string, or null if
     * the command cannot be found or executed. Called by the CLI layer.
     */
    setModelInvocableCommandsExecutor(executor) {
        this.modelInvocableCommandsExecutor = executor;
    }
    /**
     * Returns the registered model-invocable commands executor, or null if none
     * has been registered (e.g., in SDK mode).
     */
    getModelInvocableCommandsExecutor() {
        return this.modelInvocableCommandsExecutor;
    }
    getPermissionManager() {
        return this.permissionManager;
    }
    /**
     * Returns the callback for persisting permission rules to settings files.
     * Returns undefined if no callback was provided (e.g. SDK mode).
     */
    getOnPersistPermissionRule() {
        return this.onPersistPermissionRuleCallback;
    }
    async createToolRegistry(sendSdkMcpMessage, options) {
        const registry = new ToolRegistry(this, this.eventEmitter, sendSdkMcpMessage);
        // Helper: check permission then register a lazy factory (no module import
        // happens here — the dynamic import() only runs when the tool is first used).
        const registerLazy = async (toolName, factory) => {
            // PermissionManager handles both the coreTools allowlist (registry-level)
            // and deny rules (runtime-level) in a single check.
            let pmEnabled = true;
            try {
                pmEnabled = this.permissionManager
                    ? await this.permissionManager.isToolEnabled(toolName)
                    : true; // Should never reach here after initialize(), but safe default.
            }
            catch (error) {
                this.debugLogger.warn(`Failed to check permissions for tool "${toolName}", skipping registration:`, error);
                return;
            }
            if (pmEnabled) {
                registry.registerFactory(toolName, factory);
            }
        };
        if (this.getBareMode()) {
            await registerLazy(ToolNames.READ_FILE, async () => {
                const { ReadFileTool } = await import('../tools/read-file.js');
                return new ReadFileTool(this);
            });
            await registerLazy(ToolNames.EDIT, async () => {
                const { EditTool } = await import('../tools/edit.js');
                return new EditTool(this);
            });
            await registerLazy(ToolNames.SHELL, async () => {
                const { ShellTool } = await import('../tools/shell.js');
                return new ShellTool(this);
            });
            this.debugLogger.debug(`ToolRegistry created: ${JSON.stringify(registry.getAllToolNames())} (${registry.getAllToolNames().length} tools)`);
            return registry;
        }
        // --- Core tools (always registered) ---
        await registerLazy(ToolNames.AGENT, async () => {
            const { AgentTool } = await import('../tools/agent/agent.js');
            return new AgentTool(this);
        });
        await registerLazy(ToolNames.TASK_STOP, async () => {
            const { TaskStopTool } = await import('../tools/task-stop.js');
            return new TaskStopTool(this);
        });
        await registerLazy(ToolNames.SEND_MESSAGE, async () => {
            const { SendMessageTool } = await import('../tools/send-message.js');
            return new SendMessageTool(this);
        });
        await registerLazy(ToolNames.SKILL, async () => {
            const { SkillTool } = await import('../tools/skill.js');
            return new SkillTool(this);
        });
        await registerLazy(ToolNames.LS, async () => {
            const { LSTool } = await import('../tools/ls.js');
            return new LSTool(this);
        });
        await registerLazy(ToolNames.READ_FILE, async () => {
            const { ReadFileTool } = await import('../tools/read-file.js');
            return new ReadFileTool(this);
        });
        // --- Grep / RipGrep (conditional) ---
        if (this.getUseRipgrep()) {
            let useRipgrep = false;
            let errorString = undefined;
            try {
                useRipgrep = await canUseRipgrep(this.getUseBuiltinRipgrep());
            }
            catch (error) {
                errorString = getErrorMessage(error);
            }
            if (useRipgrep) {
                await registerLazy(ToolNames.GREP, async () => {
                    const { RipGrepTool } = await import('../tools/ripGrep.js');
                    return new RipGrepTool(this);
                });
            }
            else {
                logRipgrepFallback(this, new RipgrepFallbackEvent(this.getUseRipgrep(), this.getUseBuiltinRipgrep(), errorString || 'ripgrep is not available'));
                await registerLazy(ToolNames.GREP, async () => {
                    const { GrepTool } = await import('../tools/grep.js');
                    return new GrepTool(this);
                });
            }
        }
        else {
            await registerLazy(ToolNames.GREP, async () => {
                const { GrepTool } = await import('../tools/grep.js');
                return new GrepTool(this);
            });
        }
        await registerLazy(ToolNames.GLOB, async () => {
            const { GlobTool } = await import('../tools/glob.js');
            return new GlobTool(this);
        });
        await registerLazy(ToolNames.EDIT, async () => {
            const { EditTool } = await import('../tools/edit.js');
            return new EditTool(this);
        });
        await registerLazy(ToolNames.WRITE_FILE, async () => {
            const { WriteFileTool } = await import('../tools/write-file.js');
            return new WriteFileTool(this);
        });
        await registerLazy(ToolNames.SHELL, async () => {
            const { ShellTool } = await import('../tools/shell.js');
            return new ShellTool(this);
        });
        await registerLazy(ToolNames.TODO_WRITE, async () => {
            const { TodoWriteTool } = await import('../tools/todoWrite.js');
            return new TodoWriteTool(this);
        });
        await registerLazy(ToolNames.ASK_USER_QUESTION, async () => {
            const { AskUserQuestionTool } = await import('../tools/askUserQuestion.js');
            return new AskUserQuestionTool(this);
        });
        if (!this.sdkMode) {
            await registerLazy(ToolNames.EXIT_PLAN_MODE, async () => {
                const { ExitPlanModeTool } = await import('../tools/exitPlanMode.js');
                return new ExitPlanModeTool(this);
            });
        }
        await registerLazy(ToolNames.WEB_FETCH, async () => {
            const { WebFetchTool } = await import('../tools/web-fetch.js');
            return new WebFetchTool(this);
        });
        if (this.isLspEnabled() && this.getLspClient()) {
            await registerLazy(ToolNames.LSP, async () => {
                const { LspTool } = await import('../tools/lsp.js');
                return new LspTool(this);
            });
        }
        // Register cron tools unless disabled
        if (this.isCronEnabled()) {
            await registerLazy(ToolNames.CRON_CREATE, async () => {
                const { CronCreateTool } = await import('../tools/cron-create.js');
                return new CronCreateTool(this);
            });
            await registerLazy(ToolNames.CRON_LIST, async () => {
                const { CronListTool } = await import('../tools/cron-list.js');
                return new CronListTool(this);
            });
            await registerLazy(ToolNames.CRON_DELETE, async () => {
                const { CronDeleteTool } = await import('../tools/cron-delete.js');
                return new CronDeleteTool(this);
            });
        }
        // Register monitor tool
        await registerLazy(ToolNames.MONITOR, async () => {
            const { MonitorTool } = await import('../tools/monitor.js');
            return new MonitorTool(this);
        });
        if (!options?.skipDiscovery) {
            await registry.discoverAllTools();
        }
        this.debugLogger.debug(`ToolRegistry created: ${JSON.stringify(registry.getAllToolNames())} (${registry.getAllToolNames().length} tools)`);
        return registry;
    }
}
//# sourceMappingURL=config.js.map