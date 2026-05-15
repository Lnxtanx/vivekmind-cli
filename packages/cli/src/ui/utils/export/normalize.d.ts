/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ChatRecord, Config } from '@vivekmind/core';
import type { ExportSessionData } from './types.js';
/**
 * Normalizes export session data by merging tool call information from tool_result records.
 * This ensures the SSOT contains complete tool call metadata.
 */
export declare function normalizeSessionData(sessionData: ExportSessionData, originalRecords: ChatRecord[], config: Config): ExportSessionData;
