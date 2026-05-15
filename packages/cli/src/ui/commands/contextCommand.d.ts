/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type SlashCommand } from './types.js';
import { type HistoryItemContextUsage } from '../types.js';
export declare function collectContextData(config: import('@vivekmind/core').Config, showDetails: boolean): Promise<HistoryItemContextUsage>;
/**
 * Convert a HistoryItemContextUsage to a human-readable text string,
 * mirroring the layout of the interactive ContextUsage component.
 */
export declare function formatContextUsageText(data: HistoryItemContextUsage): string;
export declare const contextCommand: SlashCommand;
