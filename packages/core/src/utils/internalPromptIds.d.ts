/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 *
 * Internal Prompt ID utilities
 *
 * Centralises the set of prompt IDs used by background operations
 * (suggestion generation, forked queries) so that logging, recording,
 * and UI layers can consistently recognise and filter them.
 */
/**
 * Returns true if the prompt_id belongs to an internal background operation
 * whose events should not be recorded to the chatRecordingService,
 * OpenAI logs, or other persistent stores visible in the UI.
 *
 * Known internal IDs: `'prompt_suggestion'`, `'forked_query'`, `'speculation'`.
 */
export declare function isInternalPromptId(promptId: string): boolean;
