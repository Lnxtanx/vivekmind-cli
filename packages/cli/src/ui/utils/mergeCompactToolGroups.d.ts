/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * @fileoverview Merge consecutive tool_group history items for compact mode display.
 *
 * In compact mode, consecutive tool calls across multiple LLM turns each produce
 * separate HistoryItemToolGroup items. This utility merges them into single groups
 * for display, preserving force-expand conditions for authorization/error/shell focus.
 */
import type { HistoryItem } from '../types.js';
/**
 * Check if a tool_group history item should be excluded from merging due to force-expand conditions.
 * These conditions match ToolGroupMessage.tsx:105-112 showCompact logic.
 * Exported so MainContent can determine which callIds get their label
 * "absorbed" by the compact tool_group header vs which need the standalone
 * `● <label>` line rendered (force-expanded groups never go through the
 * compact path, so their label would otherwise be invisible).
 */
export declare function isForceExpandGroup(item: HistoryItem, embeddedShellFocused: boolean, activeShellPtyId: number | undefined): boolean;
/**
 * Merge consecutive tool_group history items for compact mode display.
 *
 * Tool_groups separated only by items hidden in compact mode (`gemini_thought`,
 * `gemini_thought_content`) are considered "consecutive" because the user
 * doesn't see anything between them visually. Hidden items between merged
 * tool_groups are dropped from the result (they would render as nothing
 * anyway in compact mode).
 *
 * @param items - History items array
 * @param embeddedShellFocused - Whether embedded shell is focused
 * @param activeShellPtyId - PTY ID of the active shell (if any)
 * @param absorbedCallIds - Set of tool callIds whose summary label is consumed
 *   by a compact-mode tool_group header (i.e., the corresponding tool_group is
 *   NOT force-expanded). Summaries for these callIds are dropped from the
 *   merged result so MainContent's refreshStatic heuristic fires and the
 *   tool_group re-renders with its label. Summaries for force-expanded groups
 *   pass through unchanged so HistoryItemDisplay can render them as standalone
 *   `● <label>` lines (the compact path doesn't consume their label).
 * @returns New array with merged tool_groups (does not mutate input)
 */
export declare function mergeCompactToolGroups(items: HistoryItem[], embeddedShellFocused?: boolean, activeShellPtyId?: number | undefined, absorbedCallIds?: ReadonlySet<string>): HistoryItem[];
