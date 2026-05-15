/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/** Size of the head/tail buffer for lite metadata reads (64KB). */
export declare const LITE_READ_BUF_SIZE: number;
/**
 * Maximum size (bytes) we'll scan in the Phase-2 full-file fallback. Tail-
 * read fast path covers the realistic case (metadata is re-appended on every
 * session lifecycle event). A pathological / corrupt session file that's
 * tens of GB should NOT block the picker for minutes while we scan it all.
 * The session picker renders on the main event loop, so blocking I/O here
 * freezes the UI.
 */
export declare const MAX_FULL_SCAN_BYTES: number;
/**
 * Unescape a JSON string value extracted as raw text.
 * Only allocates a new string when escape sequences are present.
 */
export declare function unescapeJsonString(raw: string): string;
/**
 * Extracts a simple JSON string field value from raw text without full parsing.
 * Looks for `"key":"value"` or `"key": "value"` patterns.
 * Returns the first match, or undefined if not found.
 */
export declare function extractJsonStringField(text: string, key: string): string | undefined;
/**
 * Like extractJsonStringField but finds the LAST well-formed occurrence of
 * `primaryKey` and returns every `otherKeys` value extracted from THAT SAME
 * line. Two separate `extractLastJsonStringField` calls can land on different
 * records when an older line contains only one of the fields — this function
 * guarantees the returned fields all come from the same record.
 *
 * Validation: a primary-key match counts only when its string value has a
 * proper closing quote. A crash-truncated trailing record (`"customTitle":"x`
 * with no closing `"`) is ignored — otherwise it could "win" the latest-match
 * race and cause the function to extract secondaries from a partial line
 * where they don't appear.
 *
 * When `lineContains` is provided, only lines containing that substring are
 * considered matches (same semantics as the single-field version).
 */
export declare function extractLastJsonStringFields(text: string, primaryKey: string, otherKeys: string[], lineContains?: string): Record<string, string | undefined>;
/**
 * Like extractJsonStringField but finds the LAST occurrence.
 * Useful for fields that are appended (customTitle, aiTitle, etc.)
 * where the most recent entry should win.
 *
 * When `lineContains` is provided, only matches on lines that also contain
 * the given substring are considered. This prevents false matches from user
 * content that happens to contain the same key pattern.
 */
export declare function extractLastJsonStringField(text: string, key: string, lineContains?: string): string | undefined;
/**
 * Reads a JSON string field value from a JSONL file, returning the latest
 * occurrence (last in file order).
 *
 * Two-phase strategy:
 *   1. Scan the last LITE_READ_BUF_SIZE bytes of the file; if the field is
 *      present, return it immediately. This is the common path because
 *      ChatRecordingService.finalize() re-appends metadata records to EOF
 *      on every session lifecycle event, keeping the latest title near the
 *      end of the file.
 *   2. If the tail window has no match, stream the entire file in chunks
 *      and return the last hit. This guarantees we never miss a record that
 *      landed between the head and tail windows in a large file — a blind
 *      spot the previous head+tail approach had.
 *
 * Phase 2 is a full-file scan and is intentionally slower; it is only paid
 * when Phase 1 misses.
 *
 * Returns `undefined` on any I/O error or when the field is not found.
 *
 * @param lineContains Optional substring that must appear on the same line
 *   as the matched field. See {@link extractLastJsonStringField}.
 */
export declare function readLastJsonStringFieldSync(filePath: string, key: string, lineContains?: string): string | undefined;
/**
 * Like {@link readLastJsonStringFieldSync} but extracts multiple fields from
 * the same matching line atomically (single file scan, consistent pair).
 *
 * The primary key determines the "winning" line (latest occurrence on a line
 * that also contains `lineContains`). Every other requested field is pulled
 * from that same line — never from an earlier or later record — so callers
 * get a consistent record snapshot. Useful when a record pairs a payload
 * field with its metadata (e.g. `customTitle` + `titleSource`).
 *
 * Missing fields (primary or secondary) appear in the returned object with
 * value `undefined`. I/O errors yield `undefined` for every key.
 */
export declare function readLastJsonStringFieldsSync(filePath: string, primaryKey: string, otherKeys: string[], lineContains?: string): Record<string, string | undefined>;
