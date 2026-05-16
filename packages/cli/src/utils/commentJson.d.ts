/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Updates a JSON file while preserving comments and formatting.
 * Returns true if the file was successfully written, false if the write
 * was refused (e.g. the result would not be valid JSON).
 */
export declare function updateSettingsFilePreservingFormat(filePath: string, updates: Record<string, unknown>): boolean;
export declare function applyUpdates(current: Record<string, unknown>, updates: Record<string, unknown>): Record<string, unknown>;
