/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
export declare const MAX_CONCURRENT_MONITORS = 16;
export declare const MAX_RETAINED_TERMINAL_MONITORS = 128;
export type MonitorStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export interface MonitorEntry {
    monitorId: string;
    command: string;
    description: string;
    status: MonitorStatus;
    pid?: number;
    startTime: number;
    endTime?: number;
    abortController: AbortController;
    toolUseId?: string;
    eventCount: number;
    lastEventTime: number;
    maxEvents: number;
    idleTimeoutMs: number;
    idleTimer?: ReturnType<typeof setTimeout>;
    droppedLines: number;
    /** Exit code from the underlying process, when known. */
    exitCode?: number;
    /**
     * Reason for terminal status, when one exists. Mirrors
     * `BackgroundShellEntry.error`. Populated for:
     *   - `failed` — spawn error (passed to `fail(monitorId, error)`).
     *   - `completed` via auto-stop — currently `'Max events reached'`
     *     from `emitEvent` and `'Idle timeout'` from the idle timer; any
     *     future auto-stop reason should populate this field too so the
     *     detail view stays a complete record of why the monitor stopped.
     * Not populated for `cancelled` (no semantic reason — the user / agent
     * just asked to stop) or for `completed` via natural process exit
     * (the `exitCode` field carries that signal instead).
     * Surfaced in the dialog's `MonitorDetailBody`.
     */
    error?: string;
}
export interface MonitorNotificationMeta {
    monitorId: string;
    status: MonitorStatus;
    eventCount: number;
    toolUseId?: string;
}
export type MonitorNotificationCallback = (displayText: string, modelText: string, meta: MonitorNotificationMeta) => void;
export type MonitorRegisterCallback = (entry: MonitorEntry) => void;
/**
 * Fires on any change to the registry's contents that a snapshot
 * subscriber needs to observe — concretely: `register()` (nothing →
 * running), `settle()` (running → terminal: complete / fail / cancel /
 * emitEvent's auto-stop at maxEvents / idle timeout), and `reset()`
 * (mass clear, fired with no entry).
 *
 * Does NOT fire on `emitEvent` per se — per-event registry mutations
 * (eventCount / droppedLines) are deliberately excluded so the footer
 * pill and AppContainer don't churn under heavy event traffic. The
 * dialog's detail view re-resolves selected monitor entries from the
 * registry directly when it needs live counters.
 *
 * Symmetric with `BackgroundTaskRegistry.setStatusChangeCallback` and
 * `BackgroundShellRegistry.setStatusChangeCallback` so the same UI hook
 * can subscribe to all three registries.
 */
export type MonitorStatusChangeCallback = (entry?: MonitorEntry) => void;
interface MonitorCancelOptions {
    notify?: boolean;
}
export declare class MonitorRegistry {
    private readonly monitors;
    private notificationCallback?;
    private registerCallback?;
    private statusChangeCallback?;
    register(entry: MonitorEntry): void;
    /**
     * Push a stdout line as an event notification to the agent.
     * Increments eventCount, resets idle timer, auto-stops if maxEvents reached.
     * No-op if the monitor is no longer running.
     */
    emitEvent(monitorId: string, line: string): void;
    complete(monitorId: string, exitCode: number | null): void;
    fail(monitorId: string, error: string): void;
    cancel(monitorId: string, options?: MonitorCancelOptions): void;
    get(monitorId: string): MonitorEntry | undefined;
    getAll(): MonitorEntry[];
    getRunning(): MonitorEntry[];
    setNotificationCallback(cb: MonitorNotificationCallback | undefined): void;
    setRegisterCallback(cb: MonitorRegisterCallback | undefined): void;
    /**
     * Subscribe to status transitions (register + every running → terminal
     * settle). Single-subscriber on purpose — the dialog hook is the only
     * consumer in the codebase, and a list would invite drift in
     * error-handling.
     */
    setStatusChangeCallback(cb: MonitorStatusChangeCallback | undefined): void;
    abortAll(options?: MonitorCancelOptions): void;
    reset(): void;
    private settle;
    private fireStatusChange;
    private pruneTerminalEntries;
    private resetIdleTimer;
    private clearIdleTimer;
    /** Emit a streaming event notification (status=running, includes stdout line). */
    private emitNotification;
    /** Emit a terminal notification (completed/failed/cancelled). */
    private emitTerminalNotification;
    private truncateDescription;
}
export {};
