/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Content } from '@google/genai';
import type { ClearContextOnIdleSettings } from '../../config/config.js';
export declare const MICROCOMPACT_CLEARED_MESSAGE = "[Old tool result content cleared]";
/**
 * Check whether the time-based trigger should fire.
 *
 * A toolResultsThresholdMinutes of -1 means disabled (never clear).
 */
export declare function evaluateTimeBasedTrigger(lastApiCompletionTimestamp: number | null, settings: ClearContextOnIdleSettings): {
    gapMs: number;
} | null;
export interface MicrocompactMeta {
    gapMinutes: number;
    thresholdMinutes: number;
    toolsCleared: number;
    toolsKept: number;
    keepRecent: number;
    tokensSaved: number;
}
/**
 * Microcompact history: clear old compactable tool results when the
 * time-based trigger fires.
 *
 * Returns the (potentially modified) history and optional metadata
 * about what was cleared (for logging by the caller).
 */
export declare function microcompactHistory(history: Content[], lastApiCompletionTimestamp: number | null, settings: ClearContextOnIdleSettings): {
    history: Content[];
    meta?: MicrocompactMeta;
};
