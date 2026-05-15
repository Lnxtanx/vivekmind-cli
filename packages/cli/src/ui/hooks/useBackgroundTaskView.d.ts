/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { type BackgroundTaskEntry, type BackgroundShellEntry, type Config, type MonitorEntry } from '@vivekmind/core';
export type AgentDialogEntry = BackgroundTaskEntry & {
    kind: 'agent';
    resumeBlockedReason?: string;
};
/**
 * A unified view-model entry the dialog/pill/context render against.
 * Discriminated by `kind`; per-kind fields are inlined verbatim so
 * renderer code can stay mechanical (`entry.kind === 'agent'` /
 * `'shell'` / `'monitor'` guard, then access fields directly).
 */
export type DialogEntry = AgentDialogEntry | (BackgroundShellEntry & {
    kind: 'shell';
}) | (MonitorEntry & {
    kind: 'monitor';
});
export interface UseBackgroundTaskViewResult {
    entries: readonly DialogEntry[];
}
/** Stable id of an entry regardless of kind — used as React key + lookup. */
export declare function entryId(entry: DialogEntry): string;
export declare function useBackgroundTaskView(config: Config | null): UseBackgroundTaskViewResult;
