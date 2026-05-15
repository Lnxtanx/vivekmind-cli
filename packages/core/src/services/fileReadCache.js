/**
 * @license
 * Copyright 2026 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
export class FileReadCache {
    byInode = new Map();
    /** Build the canonical key for a file from its Stats. */
    static inodeKey(stats) {
        return `${stats.dev}:${stats.ino}`;
    }
    /**
     * Record a successful Read of `absPath`.
     *
     *  - `full`      — the Read covered the entire file (no offset / limit
     *    / pages). Only full Reads enable the `file_unchanged` fast-path
     *    on subsequent reads.
     *  - `cacheable` — the produced content is suitable for substitution
     *    with a `file_unchanged` placeholder. Set true for plain text,
     *    false for binary / image / audio / video / PDF / notebook.
     */
    recordRead(absPath, stats, opts) {
        const entry = this.upsert(absPath, stats);
        entry.lastReadAt = Date.now();
        entry.lastReadWasFull = opts.full;
        entry.lastReadCacheable = opts.cacheable;
        return entry;
    }
    /**
     * Record a successful write (Edit, WriteFile, or any other tool that
     * mutates the file's bytes). After a write the on-disk mtime/size will
     * differ from any prior Read snapshot, so we refresh the cached
     * fingerprint to the post-write Stats; otherwise the next Edit would
     * see its own write as a "stale" external change.
     */
    recordWrite(absPath, stats) {
        const entry = this.upsert(absPath, stats);
        entry.lastWriteAt = Date.now();
        return entry;
    }
    /**
     * Compare the cached fingerprint against `stats` for the same inode.
     *
     *  - `unknown` — no entry. The file has never been Read or written in
     *    this session.
     *  - `stale`   — entry exists but mtime or size differs. The file has
     *    been changed by something outside our control (or by us, before
     *    this stats call was taken).
     *  - `fresh`   — entry exists and mtime + size match. Safe to assume
     *    the bytes are what we last saw.
     *
     * Note: mtime + size is a best-effort fingerprint, not a hash. A file
     * rewritten with identical mtime *and* identical size will read as
     * `fresh`. In practice the Edit path catches this via the
     * `0 occurrences` failure mode, which prompts the model to re-read.
     */
    check(stats) {
        const entry = this.byInode.get(FileReadCache.inodeKey(stats));
        if (!entry)
            return { state: 'unknown' };
        if (entry.mtimeMs !== stats.mtimeMs || entry.sizeBytes !== stats.size) {
            return { state: 'stale', entry };
        }
        return { state: 'fresh', entry };
    }
    /** Remove the entry for the given Stats, if any. */
    invalidate(stats) {
        this.byInode.delete(FileReadCache.inodeKey(stats));
    }
    /** Drop every entry. Used by tests and on Config shutdown. */
    clear() {
        this.byInode.clear();
    }
    /** Number of tracked entries. Diagnostic / test use only. */
    size() {
        return this.byInode.size;
    }
    upsert(absPath, stats) {
        const key = FileReadCache.inodeKey(stats);
        const existing = this.byInode.get(key);
        if (existing) {
            existing.realPath = absPath;
            existing.mtimeMs = stats.mtimeMs;
            existing.sizeBytes = stats.size;
            return existing;
        }
        const entry = {
            inodeKey: key,
            realPath: absPath,
            mtimeMs: stats.mtimeMs,
            sizeBytes: stats.size,
            lastReadWasFull: false,
            lastReadCacheable: false,
        };
        this.byInode.set(key, entry);
        return entry;
    }
}
//# sourceMappingURL=fileReadCache.js.map