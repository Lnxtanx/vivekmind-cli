import type { SessionScope, SessionTarget } from './types.js';
import type { AcpBridge } from './AcpBridge.js';
export declare class SessionRouter {
    private toSession;
    private toTarget;
    private toCwd;
    private bridge;
    private defaultCwd;
    private defaultScope;
    private channelScopes;
    private persistPath;
    constructor(bridge: AcpBridge, defaultCwd: string, scope?: SessionScope, persistPath?: string);
    /** Replace the bridge instance (used after crash recovery restart). */
    setBridge(bridge: AcpBridge): void;
    /** Set scope override for a specific channel. */
    setChannelScope(channelName: string, scope: SessionScope): void;
    private routingKey;
    resolve(channelName: string, senderId: string, chatId: string, threadId?: string, cwd?: string): Promise<string>;
    getTarget(sessionId: string): SessionTarget | undefined;
    hasSession(channelName: string, senderId: string, chatId?: string): boolean;
    /**
     * Delete a routing key entry from all maps. Returns the removed session ID.
     */
    private deleteByKey;
    /**
     * Remove session(s) for the given sender. Returns the removed session IDs.
     */
    removeSession(channelName: string, senderId: string, chatId?: string): string[];
    /**
     * Register an external session (e.g., created by the terminal) for a
     * specific routing key. This enables session handoff between terminal
     * and Telegram — the same session can be used from both interfaces.
     *
     * @param sessionId The ACP session ID to register
     * @param channelName The channel name (e.g., "telegram")
     * @param senderId The sender/user ID
     * @param chatId The chat ID to map this session to
     * @param threadId Optional thread ID
     * @param cwd Working directory for the session
     * @returns true if registration succeeded, false if key already occupied
     */
    registerExternalSession(sessionId: string, channelName: string, senderId: string, chatId: string, threadId?: string, cwd?: string): boolean;
    /**
     * Unregister (detach) an external session from a specific routing key.
     * This is the inverse of registerExternalSession — it removes the mapping
     * but does NOT destroy the session itself (it remains active on the terminal).
     *
     * @returns The session ID that was detached, or null if no mapping existed
     */
    unregisterSession(channelName: string, senderId: string, chatId: string): string | null;
    /**
     * Get the session ID mapped to a specific routing key, without creating one.
     * Unlike resolve(), this does NOT create a new session if none exists.
     */
    getSession(channelName: string, senderId: string, chatId: string, threadId?: string): string | undefined;
    /**
     * Detach a session from its channel routing (Phase 3: handoff back to terminal).
     * Removes the routing entry but does NOT destroy the session.
     * Returns the session ID if found.
     */
    detachSession(channelName: string, senderId: string, chatId?: string, threadId?: string): string | null;
    /**
     * Get the current session ID for a given chat.
     */
    getSessionForChat(channelName: string, senderId: string, chatId: string): string | undefined;
    /**
     * Get all session IDs associated with a specific chat (Phase 6: multi-chat).
     */
    getSessionsForChat(chatId: string): Array<{
        sessionId: string;
        senderId: string;
    }>;
    /** List all current session mappings. */
    listSessions(): Array<{
        key: string;
        sessionId: string;
        target: SessionTarget;
    }>;
    /**
     * Check for a pending terminal-to-channel handoff file.
     * If found, validates the chatId matches and returns the handoff data.
     * The caller should consume the handoff by calling `consumeHandoff()`.
     */
    checkHandoff(channelName: string, chatId: string): {
        found: boolean;
        chatId?: string;
        timestamp?: string;
    } | null;
    /**
     * Consume (read and delete) a pending handoff file.
     * Returns the handoff data if found and valid, or null otherwise.
     */
    consumeHandoff(channelName: string, chatId: string): {
        timestamp: string;
        chatId?: string;
    } | null;
    /**
     * Write a handoff marker file. Used by the terminal-side `link` command.
     * This is a static helper so it can be used without a SessionRouter instance.
     */
    static writeHandoff(channelName: string, chatId: string, data: {
        timestamp: string;
        channelId?: string;
    }): void;
    /**
     * Remove a handoff marker file. Used by the terminal-side `unlink` command.
     * Returns true if the file was found and removed, false otherwise.
     */
    static removeHandoff(channelName: string, chatId: string): boolean;
    /**
     * Check if any handoff file exists for a given channel (without specifying chatId).
     * Returns an array of chat IDs with pending handoffs.
     */
    static listHandoffs(channelName: string): string[];
    /** Get all session entries for crash recovery. */
    getAll(): Array<{
        key: string;
        sessionId: string;
        target: SessionTarget;
    }>;
    /**
     * Restore session mappings from a previous bridge.
     * Called after bridge restart — attempts loadSession for each saved mapping.
     * Failed loads are silently dropped (new session on next message).
     */
    restoreSessions(): Promise<{
        restored: number;
        failed: number;
    }>;
    /** Clear in-memory state and delete persist file. Used on clean shutdown. */
    clearAll(): void;
    private persist;
}
