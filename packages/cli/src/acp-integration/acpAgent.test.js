/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll, } from 'vitest';
// Mock cleanup module before importing anything else
const { mockRunExitCleanup } = vi.hoisted(() => ({
    mockRunExitCleanup: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/cleanup.js', () => ({
    runExitCleanup: mockRunExitCleanup,
}));
// Mock the ACP SDK
const { mockConnectionState } = vi.hoisted(() => {
    const state = {
        resolve: () => { },
        promise: null,
        reset() {
            state.promise = new Promise((r) => {
                state.resolve = r;
            });
        },
    };
    state.reset();
    return { mockConnectionState: state };
});
vi.mock('@agentclientprotocol/sdk', () => ({
    AgentSideConnection: vi.fn().mockImplementation(() => ({
        get closed() {
            return mockConnectionState.promise;
        },
    })),
    ndJsonStream: vi.fn().mockReturnValue({}),
    RequestError: class RequestError extends Error {
        static authRequired = vi
            .fn()
            .mockImplementation((data, msg) => {
            const err = new Error(msg);
            Object.assign(err, data);
            return err;
        });
        static invalidParams = vi
            .fn()
            .mockImplementation((data, msg) => {
            const err = new Error(msg);
            Object.assign(err, data);
            return err;
        });
    },
    PROTOCOL_VERSION: '1.0.0',
}));
// Mock stream conversion
vi.mock('node:stream', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Writable: { ...actual.Writable, toWeb: vi.fn().mockReturnValue({}) },
        Readable: { ...actual.Readable, toWeb: vi.fn().mockReturnValue({}) },
    };
});
// Mock core dependencies
vi.mock('@vivekmind/core', () => ({
    createDebugLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    }),
    APPROVAL_MODE_INFO: {},
    APPROVAL_MODES: [],
    AuthType: {},
    clearCachedCredentialFile: vi.fn(),
    VivekMindOAuth2Event: {},
    vivekmindOAuth2Events: { on: vi.fn(), off: vi.fn() },
    MCPServerConfig: vi.fn().mockImplementation((...args) => ({
        _args: args,
    })),
    SessionService: vi.fn(),
    tokenLimit: vi.fn(),
    SessionStartSource: {
        Startup: 'startup',
        Resume: 'resume',
    },
    SessionEndReason: {
        PromptInputExit: 'prompt_input_exit',
        Other: 'other',
    },
}));
vi.mock('./authMethods.js', () => ({ buildAuthMethods: vi.fn() }));
vi.mock('./service/filesystem.js', () => ({
    AcpFileSystemService: vi.fn(),
}));
vi.mock('../config/settings.js', () => ({
    SettingScope: {},
    loadSettings: vi.fn(),
}));
vi.mock('../config/config.js', () => ({ loadCliConfig: vi.fn() }));
vi.mock('./session/Session.js', () => ({ Session: vi.fn() }));
vi.mock('../utils/acpModelUtils.js', () => ({
    formatAcpModelId: vi.fn(),
}));
import { runAcpAgent, toStdioServer, toSseServer, toHttpServer, } from './acpAgent.js';
import { SessionEndReason, MCPServerConfig } from '@vivekmind/core';
import { AgentSideConnection } from '@agentclientprotocol/sdk';
import { loadSettings } from '../config/settings.js';
import { loadCliConfig } from '../config/config.js';
import { Session } from './session/Session.js';
describe('runAcpAgent shutdown cleanup', () => {
    let processExitSpy;
    let processOnSpy;
    let processOffSpy;
    let stdinDestroySpy;
    let stdoutDestroySpy;
    let sigTermListeners;
    let sigIntListeners;
    let mockConfig;
    const mockSettings = { merged: {} };
    const mockArgv = {};
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mockConfig after clearAllMocks
        mockConfig = {
            initialize: vi.fn().mockResolvedValue(undefined),
            getHookSystem: vi.fn().mockReturnValue(undefined),
            getDisableAllHooks: vi.fn().mockReturnValue(false),
            hasHooksForEvent: vi.fn().mockReturnValue(false),
            getModel: vi.fn().mockReturnValue('test-model'),
        };
        mockRunExitCleanup.mockResolvedValue(undefined);
        mockConnectionState.reset();
        sigTermListeners = [];
        sigIntListeners = [];
        // Intercept signal handler registration
        processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event, listener) => {
            if (event === 'SIGTERM')
                sigTermListeners.push(listener);
            if (event === 'SIGINT')
                sigIntListeners.push(listener);
            return process;
        }));
        processOffSpy = vi.spyOn(process, 'off').mockImplementation(((event, listener) => {
            if (event === 'SIGTERM') {
                sigTermListeners = sigTermListeners.filter((l) => l !== listener);
            }
            if (event === 'SIGINT') {
                sigIntListeners = sigIntListeners.filter((l) => l !== listener);
            }
            return process;
        }));
        // Mock process.exit to prevent actually exiting
        processExitSpy = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined));
        // Mock stdin/stdout destroy
        stdinDestroySpy = vi
            .spyOn(process.stdin, 'destroy')
            .mockImplementation(() => process.stdin);
        stdoutDestroySpy = vi
            .spyOn(process.stdout, 'destroy')
            .mockImplementation(() => process.stdout);
    });
    afterEach(() => {
        processExitSpy.mockRestore();
        stdinDestroySpy.mockRestore();
        stdoutDestroySpy.mockRestore();
        vi.clearAllMocks();
    });
    afterAll(() => {
        processOnSpy.mockRestore();
        processOffSpy.mockRestore();
    });
    it('calls runExitCleanup and process.exit on SIGTERM', async () => {
        // Start runAcpAgent (it will await connection.closed)
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        // Wait for signal handlers to be registered
        await vi.waitFor(() => {
            expect(sigTermListeners.length).toBeGreaterThan(0);
        });
        // Simulate SIGTERM from IDE
        sigTermListeners[0]('SIGTERM');
        // runExitCleanup is async, wait for it
        await vi.waitFor(() => {
            expect(mockRunExitCleanup).toHaveBeenCalledTimes(1);
        });
        await vi.waitFor(() => {
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });
        // Resolve connection.closed so the promise settles
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('calls runExitCleanup and process.exit on SIGINT', async () => {
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        // Wait for signal handlers to be registered
        await vi.waitFor(() => {
            expect(sigIntListeners.length).toBeGreaterThan(0);
        });
        sigIntListeners[0]('SIGINT');
        await vi.waitFor(() => {
            expect(mockRunExitCleanup).toHaveBeenCalledTimes(1);
        });
        await vi.waitFor(() => {
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('only runs shutdown once even if multiple signals arrive', async () => {
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        // Wait for signal handlers to be registered
        await vi.waitFor(() => {
            expect(sigTermListeners.length).toBeGreaterThan(0);
        });
        // Send SIGTERM twice
        sigTermListeners[0]('SIGTERM');
        sigTermListeners[0]('SIGTERM');
        await vi.waitFor(() => {
            expect(mockRunExitCleanup).toHaveBeenCalledTimes(1);
        });
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('still exits even if runExitCleanup throws', async () => {
        mockRunExitCleanup.mockRejectedValueOnce(new Error('cleanup failed'));
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        // Wait for signal handlers to be registered
        await vi.waitFor(() => {
            expect(sigTermListeners.length).toBeGreaterThan(0);
        });
        sigTermListeners[0]('SIGTERM');
        // process.exit should still be called via .finally()
        await vi.waitFor(() => {
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });
        mockConnectionState.resolve();
        await agentPromise;
    });
});
describe('runAcpAgent SessionEnd hooks', () => {
    let processExitSpy;
    let processOnSpy;
    let processOffSpy;
    let stdinDestroySpy;
    let stdoutDestroySpy;
    let sigTermListeners;
    let sigIntListeners;
    let mockConfig;
    let mockHookSystem;
    const mockSettings = { merged: {} };
    const mockArgv = {};
    beforeEach(() => {
        vi.clearAllMocks();
        mockHookSystem = {
            fireSessionEndEvent: vi.fn().mockResolvedValue(undefined),
            fireSessionStartEvent: vi.fn().mockResolvedValue(undefined),
        };
        mockConfig = {
            initialize: vi.fn().mockResolvedValue(undefined),
            getHookSystem: vi.fn().mockReturnValue(mockHookSystem),
            getDisableAllHooks: vi.fn().mockReturnValue(false),
            hasHooksForEvent: vi.fn().mockReturnValue(true),
            getModel: vi.fn().mockReturnValue('test-model'),
        };
        mockRunExitCleanup.mockResolvedValue(undefined);
        mockConnectionState.reset();
        sigTermListeners = [];
        sigIntListeners = [];
        processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event, listener) => {
            if (event === 'SIGTERM')
                sigTermListeners.push(listener);
            if (event === 'SIGINT')
                sigIntListeners.push(listener);
            return process;
        }));
        processOffSpy = vi.spyOn(process, 'off').mockImplementation(((event, listener) => {
            if (event === 'SIGTERM') {
                sigTermListeners = sigTermListeners.filter((l) => l !== listener);
            }
            if (event === 'SIGINT') {
                sigIntListeners = sigIntListeners.filter((l) => l !== listener);
            }
            return process;
        }));
        processExitSpy = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined));
        stdinDestroySpy = vi
            .spyOn(process.stdin, 'destroy')
            .mockImplementation(() => process.stdin);
        stdoutDestroySpy = vi
            .spyOn(process.stdout, 'destroy')
            .mockImplementation(() => process.stdout);
    });
    afterEach(() => {
        processExitSpy.mockRestore();
        stdinDestroySpy.mockRestore();
        stdoutDestroySpy.mockRestore();
        vi.clearAllMocks();
    });
    afterAll(() => {
        processOnSpy.mockRestore();
        processOffSpy.mockRestore();
    });
    it('fires SessionEnd hook with Other reason on SIGTERM', async () => {
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        await vi.waitFor(() => {
            expect(sigTermListeners.length).toBeGreaterThan(0);
        });
        sigTermListeners[0]('SIGTERM');
        await vi.waitFor(() => {
            expect(mockHookSystem.fireSessionEndEvent).toHaveBeenCalledWith(SessionEndReason.Other);
        });
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('fires SessionEnd hook with Other reason on SIGINT', async () => {
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        await vi.waitFor(() => {
            expect(sigIntListeners.length).toBeGreaterThan(0);
        });
        sigIntListeners[0]('SIGINT');
        await vi.waitFor(() => {
            expect(mockHookSystem.fireSessionEndEvent).toHaveBeenCalledWith(SessionEndReason.Other);
        });
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('fires SessionEnd hook with PromptInputExit on connection.closed', async () => {
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        // Resolve connection to simulate IDE disconnect
        mockConnectionState.resolve();
        await vi.waitFor(() => {
            expect(mockHookSystem.fireSessionEndEvent).toHaveBeenCalledWith(SessionEndReason.PromptInputExit);
        });
        await agentPromise;
    });
    it('does not fire SessionEnd hook when hooks are disabled', async () => {
        mockConfig.getDisableAllHooks = vi.fn().mockReturnValue(true);
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        await vi.waitFor(() => {
            expect(sigTermListeners.length).toBeGreaterThan(0);
        });
        sigTermListeners[0]('SIGTERM');
        await vi.waitFor(() => {
            expect(mockRunExitCleanup).toHaveBeenCalled();
        });
        // SessionEnd hook should NOT be called
        expect(mockHookSystem.fireSessionEndEvent).not.toHaveBeenCalled();
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('does not fire SessionEnd hook when event not registered', async () => {
        mockConfig.hasHooksForEvent = vi.fn().mockReturnValue(false);
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        await vi.waitFor(() => {
            expect(sigTermListeners.length).toBeGreaterThan(0);
        });
        sigTermListeners[0]('SIGTERM');
        await vi.waitFor(() => {
            expect(mockRunExitCleanup).toHaveBeenCalled();
        });
        // SessionEnd hook should NOT be called
        expect(mockHookSystem.fireSessionEndEvent).not.toHaveBeenCalled();
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('fires SessionEnd hook only once when SIGTERM triggers before connection.closed', async () => {
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        await vi.waitFor(() => {
            expect(sigTermListeners.length).toBeGreaterThan(0);
        });
        // Trigger SIGTERM first
        sigTermListeners[0]('SIGTERM');
        await vi.waitFor(() => {
            expect(mockHookSystem.fireSessionEndEvent).toHaveBeenCalledWith(SessionEndReason.Other);
        });
        // Now resolve connection.closed - this should NOT trigger another SessionEnd
        mockConnectionState.resolve();
        // Wait for the agent to complete
        await agentPromise;
        // SessionEnd should have been called exactly once
        expect(mockHookSystem.fireSessionEndEvent).toHaveBeenCalledTimes(1);
    });
});
// ---------------------------------------------------------------------------
// Unit tests for toStdioServer / toSseServer / toHttpServer helpers
// ---------------------------------------------------------------------------
describe('toStdioServer', () => {
    const stdioServer = {
        name: 'my-stdio',
        command: 'node',
        args: ['server.js'],
        env: [],
    };
    const sseServer = {
        type: 'sse',
        name: 'my-sse',
        url: 'http://localhost:3000/sse',
        headers: [],
    };
    it('returns the server when it is a stdio server', () => {
        expect(toStdioServer(stdioServer)).toBe(stdioServer);
    });
    it('returns undefined for SSE server', () => {
        expect(toStdioServer(sseServer)).toBeUndefined();
    });
    it('returns undefined for HTTP server', () => {
        const httpServer = {
            type: 'http',
            name: 'my-http',
            url: 'http://localhost:3000/mcp',
            headers: [],
        };
        expect(toStdioServer(httpServer)).toBeUndefined();
    });
});
describe('toSseServer', () => {
    it('returns the server when type is sse', () => {
        const sseServer = {
            type: 'sse',
            name: 'my-sse',
            url: 'http://localhost:3000/sse',
            headers: [],
        };
        const result = toSseServer(sseServer);
        expect(result).toBe(sseServer);
        expect(result?.type).toBe('sse');
    });
    it('returns undefined for stdio server', () => {
        const stdioServer = {
            name: 'my-stdio',
            command: 'node',
            args: [],
            env: [],
        };
        expect(toSseServer(stdioServer)).toBeUndefined();
    });
    it('returns undefined for http server', () => {
        const httpServer = {
            type: 'http',
            name: 'my-http',
            url: 'http://localhost:3000/mcp',
            headers: [],
        };
        expect(toSseServer(httpServer)).toBeUndefined();
    });
});
describe('toHttpServer', () => {
    it('returns the server when type is http', () => {
        const httpServer = {
            type: 'http',
            name: 'my-http',
            url: 'http://localhost:3000/mcp',
            headers: [],
        };
        const result = toHttpServer(httpServer);
        expect(result).toBe(httpServer);
        expect(result?.type).toBe('http');
    });
    it('returns undefined for stdio server', () => {
        const stdioServer = {
            name: 'my-stdio',
            command: 'node',
            args: [],
            env: [],
        };
        expect(toHttpServer(stdioServer)).toBeUndefined();
    });
    it('returns undefined for sse server', () => {
        const sseServer = {
            type: 'sse',
            name: 'my-sse',
            url: 'http://localhost:3000/sse',
            headers: [],
        };
        expect(toHttpServer(sseServer)).toBeUndefined();
    });
});
// ---------------------------------------------------------------------------
// Tests for VivekMindAgent.initialize() mcpCapabilities + newSession SSE/HTTP
// ---------------------------------------------------------------------------
describe('VivekMindAgent MCP SSE/HTTP support', () => {
    // We need to capture the agent factory from AgentSideConnection constructor
    let capturedAgentFactory;
    let mockConfig;
    let processExitSpy;
    let stdinDestroySpy;
    let stdoutDestroySpy;
    const mockArgv = {};
    beforeEach(() => {
        vi.clearAllMocks();
        mockConnectionState.reset();
        capturedAgentFactory = undefined;
        // Override AgentSideConnection mock to capture factory
        vi.mocked(AgentSideConnection).mockImplementation((factory) => {
            capturedAgentFactory = factory;
            return {
                get closed() {
                    return mockConnectionState.promise;
                },
            };
        });
        mockConfig = {
            initialize: vi.fn().mockResolvedValue(undefined),
            getHookSystem: vi.fn().mockReturnValue(undefined),
            getDisableAllHooks: vi.fn().mockReturnValue(false),
            hasHooksForEvent: vi.fn().mockReturnValue(false),
            getModel: vi.fn().mockReturnValue('test-model'),
            getModelsConfig: vi.fn().mockReturnValue({
                getCurrentAuthType: vi.fn().mockReturnValue('api-key'),
            }),
            refreshAuth: vi.fn().mockResolvedValue(undefined),
        };
        processExitSpy = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined));
        stdinDestroySpy = vi
            .spyOn(process.stdin, 'destroy')
            .mockImplementation(() => process.stdin);
        stdoutDestroySpy = vi
            .spyOn(process.stdout, 'destroy')
            .mockImplementation(() => process.stdout);
    });
    afterEach(() => {
        processExitSpy.mockRestore();
        stdinDestroySpy.mockRestore();
        stdoutDestroySpy.mockRestore();
    });
    it('initialize response includes mcpCapabilities with sse and http', async () => {
        const mockSettings = {
            merged: { mcpServers: {} },
        };
        const agentPromise = runAcpAgent(mockConfig, mockSettings, mockArgv);
        await vi.waitFor(() => expect(capturedAgentFactory).toBeDefined());
        const fakeConn = {
            get closed() {
                return mockConnectionState.promise;
            },
        };
        const agent = capturedAgentFactory(fakeConn);
        const response = await agent.initialize({ clientCapabilities: {} });
        expect(response).toMatchObject({
            agentCapabilities: {
                mcpCapabilities: {
                    sse: true,
                    http: true,
                },
            },
        });
        mockConnectionState.resolve();
        await agentPromise;
    });
    function makeInnerConfig() {
        return {
            initialize: vi.fn().mockResolvedValue(undefined),
            getModelsConfig: vi.fn().mockReturnValue({
                getCurrentAuthType: vi.fn().mockReturnValue('api-key'),
            }),
            refreshAuth: vi.fn().mockResolvedValue(undefined),
            getModel: vi.fn().mockReturnValue('m'),
            getContentGeneratorConfig: vi.fn().mockReturnValue({}),
            getAvailableModels: vi.fn().mockReturnValue([]),
            getModes: vi.fn().mockReturnValue([]),
            getApprovalMode: vi.fn().mockReturnValue('default'),
            getSessionId: vi.fn().mockReturnValue('test-session-id'),
            getAuthType: vi.fn().mockReturnValue('api-key'),
            getAllConfiguredModels: vi.fn().mockReturnValue([]),
            getGeminiClient: vi.fn().mockReturnValue({
                isInitialized: vi.fn().mockReturnValue(true),
                initialize: vi.fn().mockResolvedValue(undefined),
            }),
            getFileSystemService: vi.fn().mockReturnValue(undefined),
            setFileSystemService: vi.fn(),
            getHookSystem: vi.fn().mockReturnValue(undefined),
            getDisableAllHooks: vi.fn().mockReturnValue(true),
            hasHooksForEvent: vi.fn().mockReturnValue(false),
        };
    }
    function makeSessionSettings() {
        return {
            merged: { mcpServers: {} },
            getUserHooks: vi.fn().mockReturnValue({}),
            getProjectHooks: vi.fn().mockReturnValue({}),
        };
    }
    async function setupSessionMocks(sessionId) {
        const innerConfig = makeInnerConfig();
        vi.mocked(loadSettings).mockReturnValue(makeSessionSettings());
        vi.mocked(loadCliConfig).mockResolvedValue(innerConfig);
        vi.mocked(Session).mockImplementation(() => ({
            getId: vi.fn().mockReturnValue(sessionId),
            getConfig: vi.fn().mockReturnValue(innerConfig),
            sendAvailableCommandsUpdate: vi.fn().mockResolvedValue(undefined),
            replayHistory: vi.fn().mockResolvedValue(undefined),
            installRewriter: vi.fn(),
        }));
        return innerConfig;
    }
    it('newSession with SSE MCP server creates MCPServerConfig with url', async () => {
        await setupSessionMocks('session-sse');
        const agentPromise = runAcpAgent(mockConfig, makeSessionSettings(), mockArgv);
        await vi.waitFor(() => expect(capturedAgentFactory).toBeDefined());
        const agent = capturedAgentFactory({
            get closed() {
                return mockConnectionState.promise;
            },
        });
        await agent.newSession({
            cwd: '/tmp',
            mcpServers: [
                {
                    type: 'sse',
                    name: 'my-sse-server',
                    url: 'http://localhost:3001/sse',
                    headers: [{ name: 'Authorization', value: 'Bearer token123' }],
                },
            ],
        });
        expect(MCPServerConfig).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, 'http://localhost:3001/sse', undefined, { Authorization: 'Bearer token123' });
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('newSession with HTTP MCP server creates MCPServerConfig with httpUrl', async () => {
        await setupSessionMocks('session-http');
        const agentPromise = runAcpAgent(mockConfig, makeSessionSettings(), mockArgv);
        await vi.waitFor(() => expect(capturedAgentFactory).toBeDefined());
        const agent = capturedAgentFactory({
            get closed() {
                return mockConnectionState.promise;
            },
        });
        await agent.newSession({
            cwd: '/tmp',
            mcpServers: [
                {
                    type: 'http',
                    name: 'my-http-server',
                    url: 'http://localhost:3002/mcp',
                    headers: [],
                },
            ],
        });
        expect(MCPServerConfig).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, undefined, 'http://localhost:3002/mcp', undefined);
        mockConnectionState.resolve();
        await agentPromise;
    });
    it('newSession with SSE MCP server and empty headers passes undefined for headers', async () => {
        await setupSessionMocks('session-sse-noheaders');
        const agentPromise = runAcpAgent(mockConfig, makeSessionSettings(), mockArgv);
        await vi.waitFor(() => expect(capturedAgentFactory).toBeDefined());
        const agent = capturedAgentFactory({
            get closed() {
                return mockConnectionState.promise;
            },
        });
        await agent.newSession({
            cwd: '/tmp',
            mcpServers: [
                {
                    type: 'sse',
                    name: 'no-header-sse',
                    url: 'http://localhost:3003/sse',
                    headers: [],
                },
            ],
        });
        expect(MCPServerConfig).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, 'http://localhost:3003/sse', undefined, undefined);
        mockConnectionState.resolve();
        await agentPromise;
    });
});
//# sourceMappingURL=acpAgent.test.js.map