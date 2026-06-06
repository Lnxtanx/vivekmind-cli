import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION, } from '@agentclientprotocol/sdk';
export class AcpBridge extends EventEmitter {
    constructor(options, permissionTimeout = 60000) {
        super();
        this.child = null;
        this.connection = null;
        this._availableCommands = [];
        /** Pending permission requests awaiting channel resolution. */
        this.pendingPermissions = new Map();
        this.options = options;
        this.permissionTimeout = permissionTimeout;
        this.defaultApprovalMode = 'allow'; // default: auto-approve (legacy behavior)
    }
    /** Set the default approval mode for unresolved permission requests. */
    setDefaultApprovalMode(mode) {
        this.defaultApprovalMode = mode;
    }
    get availableCommands() {
        return this._availableCommands;
    }
    async start() {
        const { cliEntryPath, cwd } = this.options;
        const args = [cliEntryPath, '--acp'];
        if (this.options.model) {
            args.push('--model', this.options.model);
        }
        this.child = spawn(process.execPath, args, {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
            shell: false,
        });
        this.child.stderr?.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) {
                process.stderr.write(`[AcpBridge] ${msg}\n`);
            }
        });
        this.child.on('exit', (code, signal) => {
            process.stderr.write(`[AcpBridge] Process exited (code=${code}, signal=${signal})\n`);
            this.connection = null;
            this.child = null;
            this.emit('disconnected', code, signal);
        });
        // Give the process a moment to start
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!this.child || this.child.killed) {
            throw new Error('ACP process failed to start');
        }
        const stdout = Readable.toWeb(this.child.stdout);
        const stdin = Writable.toWeb(this.child.stdin);
        const stream = ndJsonStream(stdin, stdout);
        this.connection = new ClientSideConnection(() => ({
            sessionUpdate: (params) => {
                this.handleSessionUpdate(params);
                return Promise.resolve();
            },
            requestPermission: async (params) => {
                const options = Array.isArray(params.options) ? params.options : [];
                // Emit event so the channel layer can show an approval UI
                const permissionId = `${params.sessionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
                // If ask mode or channel is listening, wait for resolution
                if (this.defaultApprovalMode === 'ask' || this.listenerCount('requestPermission') > 0) {
                    return new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            this.pendingPermissions.delete(permissionId);
                            // Timeout: fall back to default mode
                            if (this.defaultApprovalMode === 'deny') {
                                resolve({
                                    outcome: { outcome: 'selected', optionId: 'deny' },
                                });
                            }
                            else {
                                const optionId = options.find((o) => o.optionId === 'proceed_once')?.optionId ||
                                    options[0]?.optionId ||
                                    'proceed_once';
                                resolve({ outcome: { outcome: 'selected', optionId } });
                            }
                        }, this.permissionTimeout);
                        const tc = params['toolCall'];
                        const request = {
                            id: permissionId,
                            sessionId: params.sessionId,
                            toolCallId: tc?.['toolCallId'] || '',
                            toolName: tc?.['kind'] || '',
                            description: tc?.['title'] || '',
                            options,
                            resolve,
                            reject,
                            timeout,
                        };
                        this.pendingPermissions.set(permissionId, request);
                        this.emit('requestPermission', request);
                    });
                }
                // Default: auto-approve (legacy behavior)
                const optionId = options.find((o) => o.optionId === 'proceed_once')?.optionId ||
                    options[0]?.optionId ||
                    'proceed_once';
                return { outcome: { outcome: 'selected', optionId } };
            },
            extNotification: async () => { },
        }), stream);
        await this.connection.initialize({
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: {},
        });
    }
    async newSession(cwd) {
        const conn = this.ensureConnection();
        const response = await conn.newSession({ cwd, mcpServers: [] });
        return response.sessionId;
    }
    async loadSession(sessionId, cwd) {
        const conn = this.ensureConnection();
        const response = await conn.loadSession({
            sessionId,
            cwd,
            mcpServers: [],
        });
        return response.sessionId;
    }
    async prompt(sessionId, text, options) {
        const conn = this.ensureConnection();
        const chunks = [];
        const onChunk = (sid, chunk) => {
            if (sid === sessionId)
                chunks.push(chunk);
        };
        this.on('textChunk', onChunk);
        const prompt = [];
        if (options?.imageBase64 && options.imageMimeType) {
            prompt.push({
                type: 'image',
                data: options.imageBase64,
                mimeType: options.imageMimeType,
            });
        }
        prompt.push({ type: 'text', text });
        try {
            await conn.prompt({
                sessionId,
                prompt: prompt,
            });
        }
        finally {
            this.off('textChunk', onChunk);
        }
        return chunks.join('');
    }
    async cancelSession(sessionId) {
        const conn = this.ensureConnection();
        await conn.cancel({ sessionId });
    }
    /** Resolve a pending permission request (called by channel adapters). */
    resolvePermission(permissionId, optionId) {
        const request = this.pendingPermissions.get(permissionId);
        if (!request)
            return false;
        clearTimeout(request.timeout);
        this.pendingPermissions.delete(permissionId);
        request.resolve({ outcome: { outcome: 'selected', optionId } });
        return true;
    }
    /** Deny a pending permission request. */
    denyPermission(permissionId) {
        const request = this.pendingPermissions.get(permissionId);
        if (!request)
            return false;
        clearTimeout(request.timeout);
        this.pendingPermissions.delete(permissionId);
        request.resolve({ outcome: { outcome: 'selected', optionId: 'deny' } });
        return true;
    }
    stop() {
        // Reject all pending permission requests
        for (const request of this.pendingPermissions.values()) {
            clearTimeout(request.timeout);
            request.reject(new Error('Bridge shutting down'));
        }
        this.pendingPermissions.clear();
        if (this.child) {
            this.child.kill();
            this.child = null;
        }
        this.connection = null;
    }
    get isConnected() {
        return (this.child !== null && !this.child.killed && this.child.exitCode === null);
    }
    handleSessionUpdate(params) {
        const { sessionId } = params;
        const update = params['update'];
        if (!update)
            return;
        const type = update['sessionUpdate'];
        switch (type) {
            case 'agent_message_chunk': {
                const content = update['content'];
                if (content?.type === 'text' && content.text) {
                    this.emit('textChunk', sessionId, content.text);
                }
                break;
            }
            case 'tool_call': {
                const event = {
                    sessionId,
                    toolCallId: update['toolCallId'],
                    kind: update['kind'] || '',
                    title: update['title'] || '',
                    status: update['status'] || 'pending',
                    rawInput: update['rawInput'],
                };
                this.emit('toolCall', event);
                break;
            }
            case 'available_commands_update': {
                if (Array.isArray(update['availableCommands'])) {
                    this._availableCommands = update['availableCommands'];
                }
                break;
            }
            default:
                // Ignore other session update types
                break;
        }
        this.emit('sessionUpdate', params);
    }
    ensureConnection() {
        if (!this.connection || !this.isConnected) {
            throw new Error('Not connected to ACP agent');
        }
        return this.connection;
    }
}
