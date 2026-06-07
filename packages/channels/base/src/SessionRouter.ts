import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SessionScope, SessionTarget } from './types.js';
import type { AcpBridge } from './AcpBridge.js';

interface PersistedEntry {
  sessionId: string;
  target: SessionTarget;
  cwd: string;
}

export class SessionRouter {
  private toSession: Map<string, string> = new Map(); // routing key → session ID
  private toTarget: Map<string, SessionTarget> = new Map(); // session ID → target
  private toCwd: Map<string, string> = new Map(); // session ID → cwd

  private bridge: AcpBridge;
  private defaultCwd: string;
  private defaultScope: SessionScope;
  private channelScopes: Map<string, SessionScope> = new Map();
  private persistPath: string | undefined;

  constructor(
    bridge: AcpBridge,
    defaultCwd: string,
    scope: SessionScope = 'user',
    persistPath?: string,
  ) {
    this.bridge = bridge;
    this.defaultCwd = defaultCwd;
    this.defaultScope = scope;
    this.persistPath = persistPath;
  }

  /** Replace the bridge instance (used after crash recovery restart). */
  setBridge(bridge: AcpBridge): void {
    this.bridge = bridge;
  }

  /** Set scope override for a specific channel. */
  setChannelScope(channelName: string, scope: SessionScope): void {
    this.channelScopes.set(channelName, scope);
  }

  private routingKey(
    channelName: string,
    senderId: string,
    chatId: string,
    threadId?: string,
  ): string {
    const scope = this.channelScopes.get(channelName) || this.defaultScope;
    switch (scope) {
      case 'thread':
        return `${channelName}:${threadId || chatId}`;
      case 'single':
        return `${channelName}:__single__`;
      case 'user':
      default:
        return `${channelName}:${senderId}:${chatId}`;
    }
  }

  async resolve(
    channelName: string,
    senderId: string,
    chatId: string,
    threadId?: string,
    cwd?: string,
  ): Promise<string> {
    const key = this.routingKey(channelName, senderId, chatId, threadId);
    const existing = this.toSession.get(key);
    if (existing) {
      return existing;
    }

    const sessionCwd = cwd || this.defaultCwd;
    const sessionId = await this.bridge.newSession(sessionCwd);
    this.toSession.set(key, sessionId);
    this.toTarget.set(sessionId, { channelName, senderId, chatId, threadId });
    this.toCwd.set(sessionId, sessionCwd);
    this.persist();
    return sessionId;
  }

  getTarget(sessionId: string): SessionTarget | undefined {
    return this.toTarget.get(sessionId);
  }

  hasSession(channelName: string, senderId: string, chatId?: string): boolean {
    const key = chatId
      ? this.routingKey(channelName, senderId, chatId)
      : `${channelName}:${senderId}`;
    // If chatId is provided, do exact lookup; otherwise prefix-scan for any match
    if (chatId) return this.toSession.has(key);
    for (const k of this.toSession.keys()) {
      if (k.startsWith(`${channelName}:${senderId}`)) return true;
    }
    return false;
  }

  /**
   * Delete a routing key entry from all maps. Returns the removed session ID.
   */
  private deleteByKey(key: string): string | null {
    const sessionId = this.toSession.get(key);
    if (!sessionId) return null;
    this.toSession.delete(key);
    this.toTarget.delete(sessionId);
    this.toCwd.delete(sessionId);
    return sessionId;
  }

  /**
   * Remove session(s) for the given sender. Returns the removed session IDs.
   */
  removeSession(
    channelName: string,
    senderId: string,
    chatId?: string,
  ): string[] {
    const removedIds: string[] = [];
    if (chatId) {
      const key = this.routingKey(channelName, senderId, chatId);
      const sessionId = this.deleteByKey(key);
      if (sessionId) removedIds.push(sessionId);
    } else {
      // No chatId: remove all sessions for this sender on this channel
      const prefix = `${channelName}:${senderId}`;
      for (const k of [...this.toSession.keys()]) {
        if (k.startsWith(prefix)) {
          const sessionId = this.deleteByKey(k);
          if (sessionId) removedIds.push(sessionId);
        }
      }
    }
    if (removedIds.length > 0) this.persist();
    return removedIds;
  }

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
  registerExternalSession(
    sessionId: string,
    channelName: string,
    senderId: string,
    chatId: string,
    threadId?: string,
    cwd?: string,
  ): boolean {
    const key = this.routingKey(channelName, senderId, chatId, threadId);
    if (this.toSession.has(key)) {
      return false; // Key already occupied by another session
    }
    const sessionCwd = cwd || this.defaultCwd;
    this.toSession.set(key, sessionId);
    this.toTarget.set(sessionId, { channelName, senderId, chatId, threadId });
    this.toCwd.set(sessionId, sessionCwd);
    this.persist();
    return true;
  }

  /**
   * Unregister (detach) an external session from a specific routing key.
   * This is the inverse of registerExternalSession — it removes the mapping
   * but does NOT destroy the session itself (it remains active on the terminal).
   *
   * @returns The session ID that was detached, or null if no mapping existed
   */
  unregisterSession(
    channelName: string,
    senderId: string,
    chatId: string,
  ): string | null {
    const key = this.routingKey(channelName, senderId, chatId);
    return this.deleteByKey(key) || null;
  }

  /**
   * Get the session ID mapped to a specific routing key, without creating one.
   * Unlike resolve(), this does NOT create a new session if none exists.
   */
  getSession(
    channelName: string,
    senderId: string,
    chatId: string,
    threadId?: string,
  ): string | undefined {
    const key = this.routingKey(channelName, senderId, chatId, threadId);
    return this.toSession.get(key);
  }

  /**
   * Detach a session from its channel routing (Phase 3: handoff back to terminal).
   * Removes the routing entry but does NOT destroy the session.
   * Returns the session ID if found.
   */
  detachSession(
    channelName: string,
    senderId: string,
    chatId?: string,
    threadId?: string,
  ): string | null {
    const key = chatId
      ? this.routingKey(channelName, senderId, chatId, threadId)
      : null;

    if (key) {
      return this.deleteByKey(key);
    }

    // No chatId: detach first found session for this sender+channel
    const prefix = `${channelName}:${senderId}`;
    for (const k of [...this.toSession.keys()]) {
      if (k.startsWith(prefix)) {
        return this.deleteByKey(k);
      }
    }
    return null;
  }

  /**
   * Get the current session ID for a given chat.
   */
  getSessionForChat(
    channelName: string,
    senderId: string,
    chatId: string,
  ): string | undefined {
    const key = this.routingKey(channelName, senderId, chatId);
    return this.toSession.get(key);
  }

  /**
   * Get all session IDs associated with a specific chat (Phase 6: multi-chat).
   */
  getSessionsForChat(chatId: string): Array<{ sessionId: string; senderId: string }> {
    const results: Array<{ sessionId: string; senderId: string }> = [];
    for (const [key, sessionId] of this.toSession) {
      if (key.includes(`:${chatId}`)) {
        const target = this.toTarget.get(sessionId);
        if (target) {
          results.push({ sessionId, senderId: target.senderId });
        }
      }
    }
    return results;
  }

  /** List all current session mappings. */
  listSessions(): Array<{ key: string; sessionId: string; target: SessionTarget }> {
    return this.getAll();
  }

  /**
   * Check for a pending terminal-to-channel handoff file.
   * If found, validates the chatId matches and returns the handoff data.
   * The caller should consume the handoff by calling `consumeHandoff()`.
   */
  checkHandoff(
    channelName: string,
    chatId: string,
  ): { found: boolean; chatId?: string; timestamp?: string } | null {
    const handoffDir = join(homedir(), '.vivekmind', 'channels');
    const filePath = join(handoffDir, `handoff-${channelName}-${chatId}.json`);

    try {
      if (!existsSync(filePath)) {
        return { found: false };
      }
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as {
        chatId?: string;
        timestamp: string;
      };
      if (data.chatId && data.chatId !== String(chatId)) {
        return { found: false };
      }
      return { found: true, chatId: data.chatId ?? String(chatId), timestamp: data.timestamp };
    } catch {
      return { found: false };
    }
  }

  /**
   * Consume (read and delete) a pending handoff file.
   * Returns the handoff data if found and valid, or null otherwise.
   */
  consumeHandoff(
    channelName: string,
    chatId: string,
  ): { timestamp: string; chatId?: string } | null {
    const handoffDir = join(homedir(), '.vivekmind', 'channels');
    const filePath = join(handoffDir, `handoff-${channelName}-${chatId}.json`);

    try {
      if (!existsSync(filePath)) {
        return null;
      }
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as {
        chatId?: string;
        timestamp: string;
      };
      if (data.chatId && data.chatId !== String(chatId)) {
        return null;
      }
      // Delete the handoff file after consuming it
      unlinkSync(filePath);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Write a handoff marker file. Used by the terminal-side `link` command.
   * This is a static helper so it can be used without a SessionRouter instance.
   */
  static writeHandoff(
    channelName: string,
    chatId: string,
    data: { timestamp: string; channelId?: string },
  ): void {
    const handoffDir = join(homedir(), '.vivekmind', 'channels');
    try {
      mkdirSync(handoffDir, { recursive: true });
    } catch {
      // best-effort
    }
    const filePath = join(handoffDir, `handoff-${channelName}-${chatId}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // best-effort — don't break anything for handoff failure
    }
  }

  /**
   * Remove a handoff marker file. Used by the terminal-side `unlink` command.
   * Returns true if the file was found and removed, false otherwise.
   */
  static removeHandoff(channelName: string, chatId: string): boolean {
    const handoffDir = join(homedir(), '.vivekmind', 'channels');
    const filePath = join(handoffDir, `handoff-${channelName}-${chatId}.json`);
    try {
      if (!existsSync(filePath)) {
        return false;
      }
      unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if any handoff file exists for a given channel (without specifying chatId).
   * Returns an array of chat IDs with pending handoffs.
   */
  static listHandoffs(channelName: string): string[] {
    const handoffDir = join(homedir(), '.vivekmind', 'channels');
    try {
      if (!existsSync(handoffDir)) return [];
      const files = readdirSync(handoffDir) as string[];
      const prefix = `handoff-${channelName}-`;
      const chatIds: string[] = [];
      for (const file of files) {
        if (file.startsWith(prefix) && file.endsWith('.json')) {
          // Extract chatId from filename: handoff-<channelName>-<chatId>.json
          const chatId = file.slice(prefix.length, -'.json'.length);
          chatIds.push(chatId);
        }
      }
      return chatIds;
    } catch {
      return [];
    }
  }

  /** Get all session entries for crash recovery. */
  getAll(): Array<{ key: string; sessionId: string; target: SessionTarget }> {
    const entries: Array<{
      key: string;
      sessionId: string;
      target: SessionTarget;
    }> = [];
    for (const [key, sessionId] of this.toSession) {
      const target = this.toTarget.get(sessionId);
      if (target) {
        entries.push({ key, sessionId, target });
      }
    }
    return entries;
  }

  /**
   * Restore session mappings from a previous bridge.
   * Called after bridge restart — attempts loadSession for each saved mapping.
   * Failed loads are silently dropped (new session on next message).
   */
  async restoreSessions(): Promise<{
    restored: number;
    failed: number;
  }> {
    if (!this.persistPath || !existsSync(this.persistPath)) {
      return { restored: 0, failed: 0 };
    }

    let entries: Record<string, PersistedEntry>;
    try {
      entries = JSON.parse(readFileSync(this.persistPath, 'utf-8'));
    } catch {
      return { restored: 0, failed: 0 };
    }

    let restored = 0;
    let failed = 0;

    for (const [key, entry] of Object.entries(entries)) {
      try {
        const sessionId = await this.bridge.loadSession(
          entry.sessionId,
          entry.cwd,
        );
        this.toSession.set(key, sessionId);
        this.toTarget.set(sessionId, entry.target);
        this.toCwd.set(sessionId, entry.cwd);
        restored++;
      } catch {
        // Session can't be loaded — will create fresh on next message
        failed++;
      }
    }

    // Update persist file to only include successfully restored sessions
    if (failed > 0) {
      this.persist();
    }

    return { restored, failed };
  }

  /** Clear in-memory state and delete persist file. Used on clean shutdown. */
  clearAll(): void {
    this.toSession.clear();
    this.toTarget.clear();
    this.toCwd.clear();
    if (this.persistPath && existsSync(this.persistPath)) {
      try {
        unlinkSync(this.persistPath);
      } catch {
        // best-effort
      }
    }
  }

  private persist(): void {
    if (!this.persistPath) return;

    const data: Record<string, PersistedEntry> = {};
    for (const [key, sessionId] of this.toSession) {
      const target = this.toTarget.get(sessionId);
      if (target) {
        data[key] = {
          sessionId,
          target,
          cwd: this.toCwd.get(sessionId) || this.defaultCwd,
        };
      }
    }

    try {
      writeFileSync(this.persistPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // best-effort — don't break message flow for persistence failure
    }
  }
}
