/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { SlashCommand } from '../commands/types.js';
/**
 * Common Windows console code pages (CP) used for encoding conversions.
 *
 * @remarks
 * - `UTF8` (65001): Unicode (UTF-8) — recommended for cross-language scripts.
 * - `GBK` (936): Simplified Chinese — default on most Chinese Windows systems.
 * - `BIG5` (950): Traditional Chinese.
 * - `LATIN1` (1252): Western European — default on many Western systems.
 */
export declare const CodePage: {
    readonly UTF8: 65001;
    readonly GBK: 936;
    readonly BIG5: 950;
    readonly LATIN1: 1252;
};
export type CodePage = (typeof CodePage)[keyof typeof CodePage];
/**
 * Checks if a query string potentially represents an '@' command.
 * It triggers if the query starts with '@' or contains '@' preceded by whitespace
 * and followed by a non-whitespace character.
 *
 * @param query The input query string.
 * @returns True if the query looks like an '@' command, false otherwise.
 */
export declare const isAtCommand: (query: string) => boolean;
/**
 * Checks if a query string potentially represents an '/' command.
 * It triggers if the query starts with '/' but excludes code comments like '//' and '/*'.
 *
 * @param query The input query string.
 * @returns True if the query looks like an '/' command, false otherwise.
 */
export declare const isSlashCommand: (query: string) => boolean;
/**
 * Checks if a query is a /btw side-question invocation.
 * Accepts both "/btw" and "?btw" prefixes.
 */
export declare const isBtwCommand: (query: string) => boolean;
export declare const copyToClipboard: (text: string) => Promise<void>;
export declare const getUrlOpenCommand: () => string;
/**
 * Represents a slash command token found mid-input (not at position 0).
 * e.g., in "hello /st", startPos=6, partialCommand="st"
 */
export type MidInputSlashCommand = {
    /** Full token including slash, e.g. "/st" */
    token: string;
    /** Position of the "/" in the full input string */
    startPos: number;
    /** Command portion without slash, e.g. "st" */
    partialCommand: string;
};
/**
 * Finds a slash command token that appears mid-input (not at position 0).
 * Only triggers when the "/" is preceded by whitespace and the cursor is
 * right at or within the partial command (no text between cursor and slash).
 *
 * Returns null when input starts with "/" (handled by start-of-line completion).
 */
export declare function findMidInputSlashCommand(input: string, cursorOffset: number): MidInputSlashCommand | null;
/**
 * Finds the best (alphabetically first) prefix-matching command for a partial
 * command string. Returns the completion suffix and full command name, or null.
 *
 * e.g. partialCommand="st" → { suffix: "ats", fullCommand: "stats" }
 */
export declare function getBestSlashCommandMatch(partialCommand: string, commands: readonly SlashCommand[]): {
    suffix: string;
    fullCommand: string;
} | null;
