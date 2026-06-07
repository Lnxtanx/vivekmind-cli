import { EventEmitter } from 'node:events';
import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';
export interface AcpBridgeOptions {
    cliEntryPath: string;
    cwd: string;
    model?: string;
}
export interface AvailableCommand {
    name: string;
    description: string;
    input?: {
        hint: string;
    } | null;
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
    options: Array<{
        optionId: string;
        label?: string;
    }>;
    resolve: (response: RequestPermissionResponse) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}
/** A custom permission handler function type. */
export type PermissionHandler = (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
export declare class AcpBridge extends EventEmitter {
    private child;
    private connection;
    private options;
    private _availableCommands;
    /** Pending permission requests awaiting channel resolution. */
    private pendingPermissions;
    /** Default permission timeout (ms). */
    private permissionTimeout;
    /** Fallback approval mode when no channel resolves a request. */
    private defaultApprovalMode;
    /**
     * Optional permission handler. When set, the bridge calls this handler
     * to resolve permission requests instead of auto-approving.
     */
    private permissionHandler?;
    constructor(options: AcpBridgeOptions, permissionTimeout?: number);
    /** Set the default approval mode for unresolved permission requests. */
    setDefaultApprovalMode(mode: 'allow' | 'deny' | 'ask'): void;
    get availableCommands(): AvailableCommand[];
    /**
     * Set a custom permission handler that will be called for every
     * requestPermission callback from the ACP agent.
     */
    setPermissionHandler(handler: ((params: RequestPermissionRequest) => Promise<RequestPermissionResponse>) | undefined): void;
    start(): Promise<void>;
    newSession(cwd: string): Promise<string>;
    loadSession(sessionId: string, cwd: string): Promise<string>;
    prompt(sessionId: string, text: string, options?: {
        imageBase64?: string;
        imageMimeType?: string;
    }): Promise<string>;
    cancelSession(sessionId: string): Promise<void>;
    /** Resolve a pending permission request (called by channel adapters). */
    resolvePermission(permissionId: string, optionId: string): boolean;
    /** Deny a pending permission request. */
    denyPermission(permissionId: string): boolean;
    stop(): void;
    get isConnected(): boolean;
    private handleSessionUpdate;
    private ensureConnection;
}
