/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Single source of truth for the human-facing label of a background
 * entry. Shared by the notification payload (model-facing) and the TUI
 * dialog (user-facing) so the two surfaces never drift.
 *
 * When `includePrefix` is true (default), returns `subagentType: desc`;
 * when false, returns the bare truncated description — used where the
 * subagent type is already rendered separately (e.g. the dialog header).
 */
export declare function buildBackgroundEntryLabel(entry: {
    description: string;
    subagentType?: string;
}, options?: {
    includePrefix?: boolean;
}): string;
export type BackgroundTaskStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export interface AgentCompletionStats {
    totalTokens: number;
    toolUses: number;
    durationMs: number;
}
/**
 * A compact record of a recent tool invocation — drives the Progress
 * section of the detail dialog. The Agent tool maintains a rolling
 * buffer of these on each background entry by subscribing to the
 * subagent's event emitter.
 */
export interface BackgroundActivity {
    /** Tool name (e.g. `Bash`, `Read`). */
    name: string;
    /** Short one-line description — the tool's own render-friendly summary. */
    description: string;
    /** Emission timestamp (ms). */
    at: number;
}
export interface BackgroundTaskEntry {
    agentId: string;
    description: string;
    subagentType?: string;
    status: BackgroundTaskStatus;
    startTime: number;
    endTime?: number;
    result?: string;
    error?: string;
    /**
     * Present only when the task is intentionally kept paused but cannot be
     * safely resumed under the current conditions.
     */
    resumeBlockedReason?: string;
    abortController: AbortController;
    stats?: AgentCompletionStats;
    toolUseId?: string;
    /**
     * The original user-supplied prompt for the background task. Surfaced
     * verbatim in the detail dialog's Prompt section. Optional because
     * resume-restored entries may not have it.
     */
    prompt?: string;
    /**
     * Rolling buffer (newest last, capped at MAX_RECENT_ACTIVITIES) of
     * recent tool invocations by this agent. Feeds the detail dialog's
     * Progress section. Replaced as a new array each time an activity is
     * appended so reference-based change detection works. Optional:
     * callers may register without providing it, and `appendActivity`
     * initializes the array lazily.
     */
    recentActivities?: readonly BackgroundActivity[];
    /** Absolute path to the agent's on-disk JSONL transcript file. */
    outputFile?: string;
    /** Absolute path to the agent's sidecar metadata file. */
    metaPath?: string;
    /** Messages queued by SendMessage, drained between tool rounds. */
    pendingMessages?: string[];
    /**
     * True once a terminal task-notification has been emitted for this entry.
     * Prevents duplicate notifications when cancel races with the natural
     * completion path (cancel aborts the signal; the agent's own handler then
     * fires the notification with the real partial/final result).
     */
    notified?: boolean;
    /**
     * Persisted sidecar status to write when the current cancellation settles.
     * Explicit user cancellation uses `cancelled`; shutdown interruption keeps
     * `running` so `/resume` can recover the work later.
     */
    persistedCancellationStatus?: Extract<BackgroundTaskStatus, 'running' | 'cancelled'>;
}
export interface NotificationMeta {
    agentId: string;
    status: BackgroundTaskStatus;
    stats?: AgentCompletionStats;
    toolUseId?: string;
}
export type BackgroundNotificationCallback = (displayText: string, modelText: string, meta: NotificationMeta) => void;
export type BackgroundRegisterCallback = (entry: BackgroundTaskEntry) => void;
interface BackgroundTaskCancelOptions {
    notify?: boolean;
    persistedStatus?: Extract<BackgroundTaskStatus, 'running' | 'cancelled'>;
}
/**
 * Fires on entry status transitions — register, complete, fail, cancel.
 * Intentionally does NOT fire on `appendActivity` so consumers that only
 * care about the pill / roster (Footer, AppContainer) don't re-render
 * on every tool call a background agent makes.
 */
export type BackgroundStatusChangeCallback = (entry?: BackgroundTaskEntry) => void;
/** Fires on `appendActivity` — scoped to detail-view consumers. */
export type BackgroundActivityChangeCallback = (entry: BackgroundTaskEntry) => void;
export declare class BackgroundTaskRegistry {
    private readonly agents;
    private notificationCallback?;
    private registerCallback?;
    private statusChangeCallback?;
    private activityChangeCallback?;
    register(entry: BackgroundTaskEntry): void;
    complete(agentId: string, result: string, stats?: AgentCompletionStats): void;
    fail(agentId: string, error: string, stats?: AgentCompletionStats): void;
    cancel(agentId: string, options?: BackgroundTaskCancelOptions): void;
    /**
     * Marks a paused interrupted task as intentionally discarded/cancelled
     * without emitting a task-notification. Used when the user explicitly
     * abandons a recovered task instead of resuming it.
     */
    abandon(agentId: string): void;
    finalizeCancelled(agentId: string, partialResult: string, stats?: AgentCompletionStats): void;
    finalizeCancellationIfPending(agentId: string): void;
    /**
     * Append a recent tool activity to a running entry's rolling buffer.
     * No-op if the entry is not running — late events after a cancellation
     * shouldn't leak into the Progress section.
     */
    appendActivity(agentId: string, activity: BackgroundActivity): void;
    get(agentId: string): BackgroundTaskEntry | undefined;
    /**
     * Snapshot of every entry regardless of status. Used by the TUI
     * footer/dialog to render rows for still-running AND terminal-state
     * tasks; the headless holdback loop keys off `hasUnfinalizedTasks`
     * instead, so callers that only need the running slice can filter
     * this snapshot at the call site.
     */
    getAll(): BackgroundTaskEntry[];
    /**
     * True if any registered task has not yet emitted its terminal
     * task-notification. Covers `running` (still executing) and
     * `cancelled`-but-not-finalized (cancel requested, but the natural
     * handler hasn't fired finalizeCancelled() yet). Headless callers
     * must keep their event loop alive while this returns true, so every
     * task_started is paired with a matching task_notification.
     */
    hasUnfinalizedTasks(): boolean;
    /**
     * Drops every in-memory entry without touching sidecar state.
     *
     * Used only when switching to a different session after the caller has
     * already established that no live work from the current session is still
     * running. Paused/interrupted entries remain recoverable from disk because
     * their sidecars keep the persisted status.
     */
    reset(): void;
    /**
     * Enqueue a message for delivery to a running background agent.
     * The agent drains this queue between tool rounds.
     */
    queueMessage(agentId: string, message: string): boolean;
    /**
     * Drain all pending messages for an agent. Returns the messages
     * and clears the queue. Called by the agent's reasoning loop.
     */
    drainMessages(agentId: string): string[];
    setNotificationCallback(cb: BackgroundNotificationCallback | undefined): void;
    setRegisterCallback(cb: BackgroundRegisterCallback | undefined): void;
    setStatusChangeCallback(cb: BackgroundStatusChangeCallback | undefined): void;
    setActivityChangeCallback(cb: BackgroundActivityChangeCallback | undefined): void;
    abortAll(options?: BackgroundTaskCancelOptions): void;
    private buildDisplayLabel;
    private emitNotification;
    private emitStatusChange;
    private emitActivityChange;
}
export {};
