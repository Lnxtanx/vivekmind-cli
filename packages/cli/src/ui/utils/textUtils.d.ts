/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Calculates the maximum width of a multi-line ASCII art string.
 * @param asciiArt The ASCII art string.
 * @returns The length of the longest line in the ASCII art.
 */
export declare const getAsciiArtWidth: (asciiArt: string) => number;
export declare function toCodePoints(str: string): string[];
export declare function cpLen(str: string): number;
export declare function cpSlice(str: string, start: number, end?: number): string;
/**
 * Strip characters that can break terminal rendering.
 *
 * Uses Node.js built-in stripVTControlCharacters to handle VT sequences,
 * then filters remaining control characters that can disrupt display.
 *
 * Characters stripped:
 * - ANSI escape sequences (via strip-ansi)
 * - VT control sequences (via Node.js util.stripVTControlCharacters)
 * - C0 control chars (0x00-0x1F) except TAB/CR/LF which are handled elsewhere
 * - C1 control chars (0x80-0x9F) that can cause display issues
 *
 * Characters preserved:
 * - All printable Unicode including emojis
 * - DEL (0x7F) - handled functionally by applyOperations, not a display issue
 * - TAB (0x09) - needed for pasted tab-separated data (e.g. from spreadsheets)
 * - CR/LF (0x0D/0x0A) - needed for line breaks
 */
export declare function stripUnsafeCharacters(str: string): string;
/**
 * Cached version of stringWidth function for better performance
 * Follows Ink's approach with unlimited cache (no eviction)
 */
export declare const getCachedStringWidth: (str: string) => number;
export interface VisualHeightSlice {
    text: string;
    hiddenLinesCount: number;
}
interface SliceTextByVisualHeightOptions {
    minHeight?: number;
    reservedRows?: number;
    overflowDirection?: 'top' | 'bottom';
}
/**
 * Bounds text by terminal visual rows before it reaches Ink/Yoga layout.
 *
 * Explicit newlines and soft wraps caused by narrow terminals both count as
 * visual rows. `overflowDirection: "top"` keeps the newest tail, which is
 * useful for streaming logs; `"bottom"` keeps the beginning, which is useful
 * for task prompts.
 */
export declare function sliceTextByVisualHeight(text: string, maxHeight: number | undefined, maxWidth: number, options?: SliceTextByVisualHeightOptions): VisualHeightSlice;
/**
 * Clear the string width cache
 */
export declare const clearStringWidthCache: () => void;
export declare function escapeAnsiCtrlCodes<T>(obj: T): T;
/**
 * Sanitizes text by redacting potentially sensitive information like API keys,
 * tokens, and passwords. Also truncates long text to a maximum length.
 *
 * @param text The text to sanitize
 * @param maxLength Maximum length of the output text (default: 200)
 * @returns Sanitized and truncated text
 */
export declare function sanitizeSensitiveText(text: string, maxLength?: number): string;
export {};
