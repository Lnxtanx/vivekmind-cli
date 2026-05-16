/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * @fileoverview BackgroundTaskRegistry — tracks background (async) sub-agents.
 *
 * When the Agent tool is called with `run_in_background: true`, the sub-agent
 * runs asynchronously. This registry tracks the lifecycle of each background
 * agent so the parent can be notified on completion.
 */
import { createDebugLogger } from '../utils/debugLogger.js';
import { escapeXml } from '../utils/xml.js';
import { patchAgentMeta } from './agent-transcript.js';
const debugLogger = createDebugLogger('BACKGROUND_TASKS');
const MAX_DESCRIPTION_LENGTH = 40;
const MAX_RECENT_ACTIVITIES = 5;
// Grace period after cancel() before emitting a fallback cancelled
// notification. The natural handler (bgBody) almost always settles and
// emits the terminal notification with the real partial result well
// within this window; the timeout only fires for pathological tools
// that ignore AbortSignal. Must be long enough that normal scheduler
// unwind wins the race, short enough that a stuck headless wait loop
// doesn't feel hung.
const CANCEL_GRACE_MS = 5000;
/**
 * Single source of truth for the human-facing label of a background
 * entry. Shared by the notification payload (model-facing) and the TUI
 * dialog (user-facing) so the two surfaces never drift.
 *
 * When `includePrefix` is true (default), returns `subagentType: desc`;
 * when false, returns the bare truncated description — used where the
 * subagent type is already rendered separately (e.g. the dialog header).
 */
export function buildBackgroundEntryLabel(entry, options = {}) {
    const { includePrefix = true } = options;
    let raw = entry.description;
    if (entry.subagentType &&
        raw.toLowerCase().startsWith(entry.subagentType.toLowerCase() + ':')) {
        raw = raw.slice(entry.subagentType.length + 1).trimStart();
    }
    const truncated = raw.length > MAX_DESCRIPTION_LENGTH
        ? raw.slice(0, MAX_DESCRIPTION_LENGTH - 1) + '\u2026'
        : raw;
    return includePrefix && entry.subagentType
        ? `${entry.subagentType}: ${truncated}`
        : truncated;
}
export class BackgroundTaskRegistry {
    agents = new Map();
    notificationCallback;
    registerCallback;
    statusChangeCallback;
    activityChangeCallback;
    register(entry) {
        if (!entry.pendingMessages)
            entry.pendingMessages = [];
        this.agents.set(entry.agentId, entry);
        debugLogger.info(`Registered background agent: ${entry.agentId}`);
        if (this.registerCallback) {
            try {
                this.registerCallback(entry);
            }
            catch (error) {
                debugLogger.error('Failed to emit register callback:', error);
            }
        }
        this.emitStatusChange(entry);
    }
    // Transition a still-running entry to 'completed' and emit the terminal
    // notification. No-op if the entry is already terminal *and* has been
    // notified — protects against duplicate emission when cancel aborts the
    // signal and the natural handler also races to completion.
    complete(agentId, result, stats) {
        const entry = this.agents.get(agentId);
        if (!entry)
            return;
        // Allow running → completed (normal path) and cancelled → completed
        // (cancel raced the natural handler: the reasoning loop finished with
        // a real result before the abort landed, and we prefer to surface that
        // real result over the bare cancel).
        if (entry.status !== 'running' && entry.status !== 'cancelled')
            return;
        if (entry.notified)
            return;
        entry.status = 'completed';
        entry.endTime = Date.now();
        entry.result = result;
        entry.stats = stats;
        debugLogger.info(`Background agent completed: ${agentId}`);
        this.emitNotification(entry);
        this.emitStatusChange(entry);
    }
    // See complete() for the cancelled → terminal path rationale.
    fail(agentId, error, stats) {
        const entry = this.agents.get(agentId);
        if (!entry)
            return;
        if (entry.status !== 'running' && entry.status !== 'cancelled')
            return;
        if (entry.notified)
            return;
        entry.status = 'failed';
        entry.endTime = Date.now();
        entry.error = error;
        entry.stats = stats;
        debugLogger.info(`Background agent failed: ${agentId}`);
        this.emitNotification(entry);
        this.emitStatusChange(entry);
    }
    // Cancellation aborts the signal and marks the entry as cancelled, but
    // does *not* emit the terminal notification immediately. The natural
    // completion path (bgBody) fires complete()/fail()/finalizeCancelled()
    // with the real partial/final result, which carries far more information
    // than a bare "cancelled" message. A deferred fallback handles the rare
    // case where a tool ignores AbortSignal and bgBody never settles — the
    // timeout lands on finalizeCancellationIfPending(), which is a no-op
    // once the natural handler has already emitted.
    cancel(agentId, options = {}) {
        const entry = this.agents.get(agentId);
        if (!entry || entry.status !== 'running')
            return;
        const persistedStatus = options.persistedStatus ?? 'cancelled';
        entry.abortController.abort();
        entry.status = 'cancelled';
        entry.endTime = Date.now();
        entry.persistedCancellationStatus = persistedStatus;
        if (entry.metaPath) {
            patchAgentMeta(entry.metaPath, {
                status: persistedStatus,
                lastUpdatedAt: new Date().toISOString(),
                lastError: undefined,
            });
        }
        debugLogger.info(`Background agent cancelled: ${agentId}`);
        this.emitStatusChange(entry);
        if (options.notify === false) {
            // Session reset paths intentionally suppress the old task's terminal
            // notification so it cannot leak into a new conversation.
            entry.notified = true;
            return;
        }
        const timer = setTimeout(() => {
            this.finalizeCancellationIfPending(agentId);
        }, CANCEL_GRACE_MS);
        timer.unref?.();
    }
    /**
     * Marks a paused interrupted task as intentionally discarded/cancelled
     * without emitting a task-notification. Used when the user explicitly
     * abandons a recovered task instead of resuming it.
     */
    abandon(agentId) {
        const entry = this.agents.get(agentId);
        if (!entry || entry.status !== 'paused')
            return;
        entry.status = 'cancelled';
        entry.endTime = Date.now();
        entry.notified = true;
        debugLogger.info(`Abandoned paused background agent: ${agentId}`);
        this.emitStatusChange(entry);
    }
    // Emit the terminal cancelled notification once the agent's natural
    // handler has confirmed that the reasoning loop ended because of the
    // abort (terminateMode === CANCELLED). Attaches the partial result and
    // stats so the parent model still sees whatever work the agent had
    // captured before the abort landed, instead of a bare "cancelled" line.
    finalizeCancelled(agentId, partialResult, stats) {
        const entry = this.agents.get(agentId);
        if (!entry)
            return;
        if (entry.status !== 'running' && entry.status !== 'cancelled')
            return;
        if (entry.notified)
            return;
        entry.status = 'cancelled';
        entry.endTime ??= Date.now();
        if (partialResult)
            entry.result = partialResult;
        entry.stats = stats;
        this.emitNotification(entry);
        this.emitStatusChange(entry);
    }
    // Emit the terminal cancelled notification for entries that were cancelled
    // but for which no natural handler delivered a follow-up complete()/fail()/
    // finalizeCancelled(). Used by shutdown paths (abortAll) to guarantee the
    // SDK contract (every registered agent produces exactly one
    // task-notification).
    finalizeCancellationIfPending(agentId) {
        const entry = this.agents.get(agentId);
        if (!entry || entry.status !== 'cancelled' || entry.notified)
            return;
        this.emitNotification(entry);
        this.emitStatusChange(entry);
    }
    /**
     * Append a recent tool activity to a running entry's rolling buffer.
     * No-op if the entry is not running — late events after a cancellation
     * shouldn't leak into the Progress section.
     */
    appendActivity(agentId, activity) {
        const entry = this.agents.get(agentId);
        if (!entry || entry.status !== 'running')
            return;
        const prior = entry.recentActivities ?? [];
        const next = [...prior, activity];
        if (next.length > MAX_RECENT_ACTIVITIES) {
            next.splice(0, next.length - MAX_RECENT_ACTIVITIES);
        }
        entry.recentActivities = next;
        this.emitActivityChange(entry);
    }
    get(agentId) {
        return this.agents.get(agentId);
    }
    /**
     * Snapshot of every entry regardless of status. Used by the TUI
     * footer/dialog to render rows for still-running AND terminal-state
     * tasks; the headless holdback loop keys off `hasUnfinalizedTasks`
     * instead, so callers that only need the running slice can filter
     * this snapshot at the call site.
     */
    getAll() {
        return Array.from(this.agents.values());
    }
    /**
     * True if any registered task has not yet emitted its terminal
     * task-notification. Covers `running` (still executing) and
     * `cancelled`-but-not-finalized (cancel requested, but the natural
     * handler hasn't fired finalizeCancelled() yet). Headless callers
     * must keep their event loop alive while this returns true, so every
     * task_started is paired with a matching task_notification.
     */
    hasUnfinalizedTasks() {
        for (const entry of this.agents.values()) {
            if (entry.status === 'running')
                return true;
            if (entry.status === 'cancelled' && !entry.notified)
                return true;
        }
        return false;
    }
    /**
     * Drops every in-memory entry without touching sidecar state.
     *
     * Used only when switching to a different session after the caller has
     * already established that no live work from the current session is still
     * running. Paused/interrupted entries remain recoverable from disk because
     * their sidecars keep the persisted status.
     */
    reset() {
        const firstEntry = this.agents.values().next().value;
        if (!firstEntry)
            return;
        this.agents.clear();
        this.emitStatusChange(firstEntry);
    }
    /**
     * Enqueue a message for delivery to a running background agent.
     * The agent drains this queue between tool rounds.
     */
    queueMessage(agentId, message) {
        const entry = this.agents.get(agentId);
        if (!entry || entry.status !== 'running')
            return false;
        const queue = entry.pendingMessages;
        queue.push(message);
        debugLogger.info(`Queued message for background agent ${agentId} (${queue.length} pending)`);
        return true;
    }
    /**
     * Drain all pending messages for an agent. Returns the messages
     * and clears the queue. Called by the agent's reasoning loop.
     */
    drainMessages(agentId) {
        const entry = this.agents.get(agentId);
        if (!entry || !entry.pendingMessages.length)
            return [];
        const messages = entry.pendingMessages.splice(0);
        debugLogger.info(`Drained ${messages.length} message(s) for background agent ${agentId}`);
        return messages;
    }
    setNotificationCallback(cb) {
        this.notificationCallback = cb;
    }
    setRegisterCallback(cb) {
        this.registerCallback = cb;
    }
    setStatusChangeCallback(cb) {
        this.statusChangeCallback = cb;
    }
    setActivityChangeCallback(cb) {
        this.activityChangeCallback = cb;
    }
    abortAll(options = {}) {
        const cancelOptions = {
            persistedStatus: 'running',
            ...options,
        };
        for (const entry of Array.from(this.agents.values())) {
            if (entry.status === 'running') {
                this.cancel(entry.agentId, cancelOptions);
            }
            if (cancelOptions.notify === false) {
                entry.notified = true;
                continue;
            }
            // Shutdown path: no natural handler will run, so emit the cancelled
            // notification here to honour the one-notification-per-agent contract.
            this.finalizeCancellationIfPending(entry.agentId);
        }
        debugLogger.info('Aborted all background agents');
    }
    buildDisplayLabel(entry) {
        return buildBackgroundEntryLabel(entry);
    }
    emitNotification(entry) {
        // Mark notified *before* invoking the callback so that a re-entrant
        // terminal call inside the callback chain (cancel → complete race)
        // sees the flag and short-circuits, rather than firing twice.
        if (entry.notified)
            return;
        entry.notified = true;
        if (!this.notificationCallback)
            return;
        const statusText = entry.status === 'completed'
            ? 'completed'
            : entry.status === 'failed'
                ? 'failed'
                : 'was cancelled';
        const label = this.buildDisplayLabel(entry);
        const displayLine = `Background agent "${label}" ${statusText}.`;
        const xmlParts = [
            '<task-notification>',
            `<task-id>${escapeXml(entry.agentId)}</task-id>`,
        ];
        if (entry.toolUseId) {
            xmlParts.push(`<tool-use-id>${escapeXml(entry.toolUseId)}</tool-use-id>`);
        }
        xmlParts.push(`<status>${escapeXml(entry.status)}</status>`, `<summary>Agent "${escapeXml(entry.description)}" ${statusText}.</summary>`);
        if (entry.result) {
            xmlParts.push(`<result>${escapeXml(entry.result)}</result>`);
        }
        if (entry.error) {
            xmlParts.push(`<result>Error: ${escapeXml(entry.error)}</result>`);
        }
        if (entry.outputFile) {
            xmlParts.push(`<output-file>${escapeXml(entry.outputFile)}</output-file>`);
        }
        if (entry.stats) {
            xmlParts.push('<usage>', `<total_tokens>${entry.stats.totalTokens}</total_tokens>`, `<tool_uses>${entry.stats.toolUses}</tool_uses>`, `<duration_ms>${entry.stats.durationMs}</duration_ms>`, '</usage>');
        }
        xmlParts.push('</task-notification>');
        const meta = {
            agentId: entry.agentId,
            status: entry.status,
            stats: entry.stats,
            toolUseId: entry.toolUseId,
        };
        try {
            this.notificationCallback(displayLine, xmlParts.join('\n'), meta);
        }
        catch (error) {
            debugLogger.error('Failed to emit background notification:', error);
        }
    }
    emitStatusChange(entry) {
        if (!this.statusChangeCallback)
            return;
        try {
            this.statusChangeCallback(entry);
        }
        catch (error) {
            debugLogger.error('Failed to emit background status change:', error);
        }
    }
    emitActivityChange(entry) {
        if (!this.activityChangeCallback)
            return;
        try {
            this.activityChangeCallback(entry);
        }
        catch (error) {
            debugLogger.error('Failed to emit background activity change:', error);
        }
    }
}
//# sourceMappingURL=background-tasks.js.map