/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Result of validating a symlink entry's scope inside a skills directory.
 *
 *  - `ok: true`  → target exists, is a directory, and stays inside `baseRealPath`.
 *  - `ok: false` → one of `escapes` / `not-directory` / `invalid` (broken or
 *    permission-denied symlink). Callers log a warn and skip the entry.
 */
export type SymlinkScopeCheck = {
    ok: true;
    realPath: string;
} | {
    ok: false;
    reason: 'escapes' | 'not-directory' | 'invalid';
    error?: unknown;
};
/**
 * Validate that a symlink at `skillDir` (a) resolves, (b) targets a
 * directory, and (c) stays within `baseRealPath` after both sides are
 * canonicalized.
 *
 * Caller contract:
 *  - Pass `baseRealPath` already realpath-resolved (typically once outside
 *    a directory-iteration loop). The helper canonicalizes the target
 *    again to keep both sides on the same canonical form — `path.resolve`
 *    alone only collapses `.` / `..` / relative segments, leaving Windows
 *    case differences and short-vs-long-path forms unrecorded. The
 *    failing Windows CI on the symlinked-skill test traced back to that
 *    asymmetry: `realpath(target)` returned the long-form, casing-fixed
 *    path while the prefix being compared was the raw `path.resolve(base)`,
 *    so a legitimate in-tree symlink got flagged as escaping.
 *
 * Containment uses `path.relative` rather than `startsWith(base + sep)`
 * so we don't false-positive on sibling directories whose names happen
 * to share a prefix with the base, and we get cross-platform separator
 * handling for free. The `'..'`-prefix and `path.isAbsolute` checks
 * cover both POSIX (`../foo`) and Windows (`C:\\elsewhere\\foo` →
 * absolute relative-path) escape shapes.
 *
 * Without the scope check at all, a symlink anywhere in the skills tree
 * could pull in arbitrary on-disk content as a "skill" — and skills can
 * ship hooks that invoke shell commands, so this is a code-execution
 * vector. Used by both `skill-load.ts` (sequential extension parser) and
 * `skill-manager.ts` (parallel project/user/bundled parser); kept here
 * so the two paths can't drift.
 */
export declare function validateSymlinkScope(skillDir: string, baseRealPath: string): Promise<SymlinkScopeCheck>;
