import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
} from '@agentclientprotocol/sdk';
import type {
  Client,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@agentclientprotocol/sdk';

export interface AcpBridgeOptions {
  cliEntryPath: string;
  cwd: string;
  model?: string;
}

export interface AvailableCommand {
  name: string;
  description: string;
  input?: { hint: string } | null;
}

export interface ToolCallEvent {
  sessionId: string;
  toolCallId: string;
  kind: string;
  title: string;
  status: string;
  rawInput?: Record<string, unknown>;
}

/** Pending permission request waiting for channel resolution. */
export interface PendingPermissionRequest {
  id: string;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  description: string;
  options: Array<{ optionId: string; label?: string }>;
  resolve: (response: RequestPermissionResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** A custom permission handler function type. */
export type PermissionHandler = (
  params: RequestPermissionRequest,
) => Promise<RequestPermissionResponse>;

export class AcpBridge extends EventEmitter {
  private child: ChildProcess | null = null;
  private connection: ClientSideConnection | null = null;
  private options: AcpBridgeOptions;
  private _availableCommands: AvailableCommand[] = [];
  /** Pending permission requests awaiting channel resolution. */
  private pendingPermissions: Map<string, PendingPermissionRequest> = new Map();
  /** Default permission timeout (ms). */
  private permissionTimeout: number;
  /** Fallback approval mode when no channel resolves a request. */
  private defaultApprovalMode: 'allow' | 'deny' | 'ask';

  /**
   * Optional permission handler. When set, the bridge calls this handler
   * to resolve permission requests instead of auto-approving.
   */
  private permissionHandler?:
    | ((params: RequestPermissionRequest) => Promise<RequestPermissionResponse>)
    | undefined;

  constructor(options: AcpBridgeOptions, permissionTimeout = 60000) {
    super();
    this.options = options;
    this.permissionTimeout = permissionTimeout;
    this.defaultApprovalMode = 'allow'; // default: auto-approve (legacy behavior)
  }

  /** Set the default approval mode for unresolved permission requests. */
  setDefaultApprovalMode(mode: 'allow' | 'deny' | 'ask'): void {
    this.defaultApprovalMode = mode;
  }

  get availableCommands(): AvailableCommand[] {
    return this._availableCommands;
  }

  /**
   * Set a custom permission handler that will be called for every
   * requestPermission callback from the ACP agent.
   */
  setPermissionHandler(
    handler:
      | ((
          params: RequestPermissionRequest,
        ) => Promise<RequestPermissionResponse>)
      | undefined,
  ): void {
    this.permissionHandler = handler;
  }

  async start(): Promise<void> {
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

    this.child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        process.stderr.write(`[AcpBridge] ${msg}\n`);
      }
    });

    this.child.on('exit', (code, signal) => {
      process.stderr.write(
        `[AcpBridge] Process exited (code=${code}, signal=${signal})\n`,
      );
      this.connection = null;
      this.child = null;
      this.emit('disconnected', code, signal);
    });

    // Give the process a moment to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!this.child || this.child.killed) {
      throw new Error('ACP process failed to start');
    }

    const stdout = Readable.toWeb(
      this.child.stdout!,
    ) as ReadableStream<Uint8Array>;
    const stdin = Writable.toWeb(this.child.stdin!) as WritableStream;
    const stream = ndJsonStream(stdin, stdout);

    this.connection = new ClientSideConnection(
      (): Client => ({
        sessionUpdate: (params: SessionNotification): Promise<void> => {
          this.handleSessionUpdate(params);
          return Promise.resolve();
        },

        requestPermission: async (
          params: RequestPermissionRequest,
        ): Promise<RequestPermissionResponse> => {
          // If a custom permission handler is registered, delegate to it
          if (this.permissionHandler) {
            return this.permissionHandler(params);
          }

          const options = Array.isArray(params.options) ? params.options : [];

          // Emit event so the channel layer can show an approval UI
          const permissionId = `${params.sessionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

          // If ask mode or channel is listening, wait for resolution
          if (this.defaultApprovalMode === 'ask' || this.listenerCount('requestPermission') > 0) {
            return new Promise<RequestPermissionResponse>((resolve, reject) => {
              const timeout = setTimeout(() => {
                this.pendingPermissions.delete(permissionId);
                // Timeout: fall back to default mode
                if (this.defaultApprovalMode === 'deny') {
                  resolve({
                    outcome: { outcome: 'selected', optionId: 'deny' },
                  });
                } else {
                  const optionId =
                    options.find((o) => o.optionId === 'proceed_once')?.optionId ||
                    options[0]?.optionId ||
                    'proceed_once';
                  resolve({ outcome: { outcome: 'selected', optionId } });
                }
              }, this.permissionTimeout);

              const tc = (params as unknown as Record<string, unknown>)['toolCall'] as Record<string, unknown> | undefined;
              const request: PendingPermissionRequest = {
                id: permissionId,
                sessionId: params.sessionId,
                toolCallId: tc?.['toolCallId'] as string || '',
                toolName: tc?.['kind'] as string || '',
                description: tc?.['title'] as string || '',
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
          const optionId =
            options.find((o) => o.optionId === 'proceed_once')?.optionId ||
            options[0]?.optionId ||
            'proceed_once';
          return { outcome: { outcome: 'selected', optionId } };
        },

        extNotification: async (): Promise<void> => {},
      }),
      stream,
    );

    await this.connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {},
    });
  }

  async newSession(cwd: string): Promise<string> {
    const conn = this.ensureConnection();
    const response = await conn.newSession({ cwd, mcpServers: [] });
    return response.sessionId;
  }

  async loadSession(sessionId: string, cwd: string): Promise<string> {
    const conn = this.ensureConnection();
    const response = await conn.loadSession({
      sessionId,
      cwd,
      mcpServers: [],
    });
    return response.sessionId;
  }

  async prompt(
    sessionId: string,
    text: string,
    options?: { imageBase64?: string; imageMimeType?: string },
  ): Promise<string> {
    const conn = this.ensureConnection();

    const chunks: string[] = [];
    const onChunk = (sid: string, chunk: string) => {
      if (sid === sessionId) chunks.push(chunk);
    };
    this.on('textChunk', onChunk);

    const prompt: Array<Record<string, unknown>> = [];
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
        prompt: prompt as Array<{ type: 'text'; text: string }>,
      });
    } finally {
      this.off('textChunk', onChunk);
    }

    return chunks.join('');
  }

  async cancelSession(sessionId: string): Promise<void> {
    const conn = this.ensureConnection();
    await conn.cancel({ sessionId });
  }

  /** Resolve a pending permission request (called by channel adapters). */
  resolvePermission(permissionId: string, optionId: string): boolean {
    const request = this.pendingPermissions.get(permissionId);
    if (!request) return false;
    clearTimeout(request.timeout);
    this.pendingPermissions.delete(permissionId);
    request.resolve({ outcome: { outcome: 'selected', optionId } });
    return true;
  }

  /** Deny a pending permission request. */
  denyPermission(permissionId: string): boolean {
    const request = this.pendingPermissions.get(permissionId);
    if (!request) return false;
    clearTimeout(request.timeout);
    this.pendingPermissions.delete(permissionId);
    request.resolve({ outcome: { outcome: 'selected', optionId: 'deny' } });
    return true;
  }

  stop(): void {
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

  get isConnected(): boolean {
    return (
      this.child !== null && !this.child.killed && this.child.exitCode === null
    );
  }

  private handleSessionUpdate(params: SessionNotification): void {
    const { sessionId } = params;
    const update = (params as unknown as Record<string, unknown>)['update'] as
      | Record<string, unknown>
      | undefined;
    if (!update) return;

    const type = update['sessionUpdate'] as string;

    switch (type) {
      case 'agent_message_chunk': {
        const content = update['content'] as
          | { type?: string; text?: string }
          | undefined;
        if (content?.type === 'text' && content.text) {
          this.emit('textChunk', sessionId, content.text);
        }
        break;
      }
      case 'tool_call': {
        const event: ToolCallEvent = {
          sessionId,
          toolCallId: update['toolCallId'] as string,
          kind: (update['kind'] as string) || '',
          title: (update['title'] as string) || '',
          status: (update['status'] as string) || 'pending',
          rawInput: update['rawInput'] as Record<string, unknown> | undefined,
        };
        this.emit('toolCall', event);
        break;
      }
      case 'available_commands_update': {
        if (Array.isArray(update['availableCommands'])) {
          this._availableCommands = update[
            'availableCommands'
          ] as AvailableCommand[];
        }
        break;
      }
      default:
        // Ignore other session update types
        break;
    }

    this.emit('sessionUpdate', params);
  }

  private ensureConnection(): ClientSideConnection {
    if (!this.connection || !this.isConnected) {
      throw new Error('Not connected to ACP agent');
    }
    return this.connection;
  }
}
