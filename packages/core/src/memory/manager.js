/**
 * @license
 * Copyright 2026 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * MemoryManager — the single entry-point for all memory module operations.
 *
 * # Design
 * All background-task state (in-flight promises, per-project extraction queues,
 * per-project dream-scan timestamps, task records) is owned directly by
 * MemoryManager using plain Maps and sets. There are no separate
 * BackgroundTaskRegistry / BackgroundTaskDrainer / BackgroundTaskScheduler
 * helper classes; those abstractions are replaced by straightforward inline
 * state management inside this class.
 *
 * Public API — everything external callers need:
 *   config.getMemoryManager().scheduleExtract(params)
 *   config.getMemoryManager().scheduleDream(params)
 *   config.getMemoryManager().recall(projectRoot, query, options)
 *   config.getMemoryManager().forget(projectRoot, query, options)
 *   config.getMemoryManager().getStatus(projectRoot)
 *   config.getMemoryManager().drain(options?)
 *   config.getMemoryManager().appendToUserMemory(userMemory, projectRoot)
 *
 * # Task records
 * Each scheduled operation is tracked as a lightweight MemoryTaskRecord.
 * These are queryable by type and projectRoot for status display.
 *
 * # Injection for tests
 * Production code uses `config.getMemoryManager()`. Tests that need isolation
 * construct `new MemoryManager()` directly.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Storage } from '../config/storage.js';
import { logMemoryExtract, MemoryExtractEvent } from '../telemetry/index.js';
import { isAutoMemPath } from './paths.js';
import { getAutoMemoryConsolidationLockPath, getAutoMemoryMetadataPath, } from './paths.js';
import { ensureAutoMemoryScaffold } from './store.js';
import { runAutoMemoryExtract } from './extract.js';
import { runManagedAutoMemoryDream } from './dream.js';
import { forgetManagedAutoMemoryEntries, forgetManagedAutoMemoryMatches, selectManagedAutoMemoryForgetCandidates, } from './forget.js';
import { resolveRelevantAutoMemoryPromptForQuery, } from './recall.js';
import { getManagedAutoMemoryStatus } from './status.js';
import { appendManagedAutoMemoryToUserMemory } from './prompt.js';
import { writeDreamManualRunToMetadata } from './dream.js';
import { buildConsolidationTaskPrompt } from './dreamAgentPlanner.js';
// ─── Constants ────────────────────────────────────────────────────────────────
export const EXTRACT_TASK_TYPE = 'managed-auto-memory-extraction';
export const DREAM_TASK_TYPE = 'managed-auto-memory-dream';
export const DEFAULT_AUTO_DREAM_MIN_HOURS = 24;
export const DEFAULT_AUTO_DREAM_MIN_SESSIONS = 5;
const DREAM_LOCK_STALE_MS = 60 * 60 * 1000; // 1 hour
const SESSION_SCAN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const WRITE_TOOL_NAMES = new Set([
    'write_file',
    'edit',
    'replace',
    'create_file',
]);
// ─── Internal helpers ─────────────────────────────────────────────────────────
function makeTaskRecord(type, projectRoot, sessionId) {
    const now = new Date().toISOString();
    return {
        id: randomUUID(),
        taskType: type,
        projectRoot,
        sessionId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    };
}
function updateRecord(record, patch) {
    if (patch.status !== undefined)
        record.status = patch.status;
    if (patch.progressText !== undefined)
        record.progressText = patch.progressText;
    if (patch.error !== undefined)
        record.error = patch.error;
    if (patch.metadata !== undefined) {
        record.metadata = { ...(record.metadata ?? {}), ...patch.metadata };
    }
    record.updatedAt = new Date().toISOString();
}
function partWritesToMemory(part, projectRoot) {
    const name = part.functionCall?.name;
    if (name && WRITE_TOOL_NAMES.has(name)) {
        const args = part.functionCall?.args;
        const filePath = args?.['file_path'] ?? args?.['path'] ?? args?.['target_file'];
        if (typeof filePath === 'string' && isAutoMemPath(filePath, projectRoot)) {
            return true;
        }
    }
    return false;
}
function historyWritesToMemory(history, projectRoot) {
    return history.some((msg) => (msg.parts ?? []).some((p) => partWritesToMemory(p, projectRoot)));
}
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
async function readDreamMetadata(projectRoot) {
    const content = await fs.readFile(getAutoMemoryMetadataPath(projectRoot), 'utf-8');
    return JSON.parse(content);
}
async function writeDreamMetadata(projectRoot, metadata) {
    await fs.writeFile(getAutoMemoryMetadataPath(projectRoot), `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');
}
function hoursSince(lastDreamAt, now) {
    if (!lastDreamAt)
        return null;
    const timestamp = Date.parse(lastDreamAt);
    if (Number.isNaN(timestamp))
        return null;
    return (now.getTime() - timestamp) / (1000 * 60 * 60);
}
const SESSION_FILE_PATTERN = /^[0-9a-fA-F-]{32,36}\.jsonl$/;
async function defaultSessionScanner(projectRoot, sinceMs, excludeSessionId) {
    const chatsDir = path.join(new Storage(projectRoot).getProjectDir(), 'chats');
    let names;
    try {
        names = await fs.readdir(chatsDir);
    }
    catch {
        return [];
    }
    const results = [];
    await Promise.all(names.map(async (name) => {
        if (!SESSION_FILE_PATTERN.test(name))
            return;
        const sessionId = name.slice(0, -'.jsonl'.length);
        if (sessionId === excludeSessionId)
            return;
        try {
            const stats = await fs.stat(path.join(chatsDir, name));
            if (stats.mtimeMs > sinceMs)
                results.push(sessionId);
        }
        catch {
            // skip unreadable files
        }
    }));
    return results;
}
async function dreamLockExists(projectRoot) {
    const lockPath = getAutoMemoryConsolidationLockPath(projectRoot);
    let mtimeMs;
    let holderPid;
    try {
        const [stats, content] = await Promise.all([
            fs.stat(lockPath),
            fs.readFile(lockPath, 'utf-8').catch(() => ''),
        ]);
        mtimeMs = stats.mtimeMs;
        const parsed = parseInt(content.trim(), 10);
        holderPid = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }
    catch {
        return false; // ENOENT — no lock
    }
    const ageMs = Date.now() - mtimeMs;
    if (ageMs <= DREAM_LOCK_STALE_MS) {
        if (holderPid !== undefined && isProcessRunning(holderPid))
            return true;
        await fs.rm(lockPath, { force: true });
        return false;
    }
    await fs.rm(lockPath, { force: true });
    return false;
}
async function acquireDreamLock(projectRoot) {
    await fs.writeFile(getAutoMemoryConsolidationLockPath(projectRoot), String(process.pid), { flag: 'wx' });
}
async function releaseDreamLock(projectRoot) {
    await fs.rm(getAutoMemoryConsolidationLockPath(projectRoot), {
        force: true,
    });
}
// ─── MemoryManager ────────────────────────────────────────────────────────────
/**
 * MemoryManager owns all runtime state for the memory subsystem and exposes a
 * clean, stable API. It is created once per Config instance and returned by
 * `config.getMemoryManager()`. Tests pass a fresh `new MemoryManager()`.
 */
export class MemoryManager {
    // ── Task records ────────────────────────────────────────────────────────────
    tasks = new Map();
    // ── Subscribers (useSyncExternalStore / custom listeners) ────────────────
    subscribers = new Set();
    // ── In-flight promises (for drain) ──────────────────────────────────────────
    inFlight = new Map();
    // ── Extract scheduling state ─────────────────────────────────────────────────
    extractRunning = new Set();
    extractCurrentTaskId = new Map();
    extractQueued = new Map();
    // ── Dream scheduling state ───────────────────────────────────────────────────
    dreamInFlightByKey = new Map();
    dreamLastSessionScanAt = new Map();
    sessionScanner;
    constructor(sessionScanner = defaultSessionScanner) {
        this.sessionScanner = sessionScanner;
    }
    // ─── Subscribe ───────────────────────────────────────────────────────────────────
    /**
     * Register a listener that is called whenever any task record changes.
     * Compatible with React’s `useSyncExternalStore`.
     * Returns an unsubscribe function.
     */
    subscribe(listener) {
        this.subscribers.add(listener);
        return () => this.subscribers.delete(listener);
    }
    notify() {
        for (const fn of this.subscribers)
            fn();
    }
    /** Update a record and notify subscribers. */
    update(record, patch) {
        updateRecord(record, patch);
        this.notify();
    }
    /**
     * Register a brand-new record in the task map and notify once.
     * Use this for records that start in 'pending' and need no immediate patch.
     */
    store(record) {
        this.tasks.set(record.id, record);
        this.notify();
    }
    /**
     * Register a brand-new record AND apply an initial status patch in a single
     * notify. Avoids the double-render that separate store()+update() causes.
     */
    storeWith(record, patch) {
        updateRecord(record, patch);
        this.tasks.set(record.id, record);
        this.notify();
    }
    // ─── Task record query ────────────────────────────────────────────────────────
    /** Return task records filtered by type and optionally by projectRoot. */
    listTasksByType(taskType, projectRoot) {
        return [...this.tasks.values()]
            .filter((t) => t.taskType === taskType &&
            (!projectRoot || t.projectRoot === projectRoot))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    // ─── Drain ────────────────────────────────────────────────────────────────────
    /** Wait for all in-flight tasks to settle, with optional timeout. */
    async drain(options = {}) {
        const promises = [...this.inFlight.values()];
        if (promises.length === 0)
            return true;
        const waitAll = Promise.allSettled(promises).then(() => true);
        if (!options.timeoutMs || options.timeoutMs <= 0)
            return waitAll;
        return Promise.race([
            waitAll,
            new Promise((resolve) => setTimeout(() => resolve(false), options.timeoutMs)),
        ]);
    }
    track(taskId, promise) {
        this.inFlight.set(taskId, promise);
        void promise.finally(() => this.inFlight.delete(taskId));
        return promise;
    }
    // ─── Extract ──────────────────────────────────────────────────────────────────
    /**
     * Schedule a managed auto-memory extraction for the given session turn.
     *
     * Returns immediately with a skipped result if:
     *   - The last history turn wrote to a memory file (memory_tool)
     *   - Extraction is already running for this project (queues trailing request)
     *
     * The trailing request starts automatically when the active extraction
     * completes.
     */
    async scheduleExtract(params) {
        if (historyWritesToMemory(params.history, params.projectRoot)) {
            const record = makeTaskRecord('extract', params.projectRoot, params.sessionId);
            this.storeWith(record, {
                status: 'skipped',
                progressText: 'Skipped: main agent wrote to memory files this turn.',
                metadata: {
                    skippedReason: 'memory_tool',
                    historyLength: params.history.length,
                },
            });
            return {
                touchedTopics: [],
                skippedReason: 'memory_tool',
                cursor: {
                    sessionId: params.sessionId,
                    updatedAt: (params.now ?? new Date()).toISOString(),
                },
            };
        }
        if (this.extractRunning.has(params.projectRoot)) {
            const currentTaskId = this.extractCurrentTaskId.get(params.projectRoot);
            if (!currentTaskId) {
                return {
                    touchedTopics: [],
                    skippedReason: 'already_running',
                    cursor: {
                        sessionId: params.sessionId,
                        updatedAt: (params.now ?? new Date()).toISOString(),
                    },
                };
            }
            const queued = this.extractQueued.get(params.projectRoot);
            if (queued) {
                // Supersede the existing queued request with newer params
                queued.params = params;
                const queuedRecord = this.tasks.get(queued.taskId);
                if (queuedRecord) {
                    this.update(queuedRecord, {
                        status: 'pending',
                        progressText: 'Updated trailing managed auto-memory extraction request while another extraction is running.',
                        metadata: {
                            queuedBehindTaskId: currentTaskId,
                            historyLength: params.history.length,
                            supersededAt: new Date().toISOString(),
                        },
                    });
                }
            }
            else {
                const record = makeTaskRecord('extract', params.projectRoot, params.sessionId);
                this.storeWith(record, {
                    status: 'pending',
                    progressText: 'Queued trailing managed auto-memory extraction until the active extraction completes.',
                    metadata: {
                        trailing: true,
                        queuedBehindTaskId: currentTaskId,
                        historyLength: params.history.length,
                    },
                });
                this.extractQueued.set(params.projectRoot, {
                    taskId: record.id,
                    params,
                });
            }
            return {
                touchedTopics: [],
                skippedReason: 'queued',
                cursor: {
                    sessionId: params.sessionId,
                    updatedAt: (params.now ?? new Date()).toISOString(),
                },
            };
        }
        const record = makeTaskRecord('extract', params.projectRoot, params.sessionId);
        this.store(record);
        return this.track(record.id, this.runExtract(record.id, params));
    }
    async runExtract(taskId, params) {
        const record = this.tasks.get(taskId);
        this.extractCurrentTaskId.set(params.projectRoot, taskId);
        this.extractRunning.add(params.projectRoot);
        this.update(record, {
            status: 'running',
            progressText: 'Running managed auto-memory extraction.',
            metadata: { historyLength: params.history.length },
        });
        const t0 = Date.now();
        try {
            const result = await runAutoMemoryExtract(params);
            const durationMs = Date.now() - t0;
            this.update(record, {
                status: result.skippedReason ? 'skipped' : 'completed',
                progressText: result.systemMessage ??
                    (result.touchedTopics.length > 0
                        ? `Managed auto-memory updated: ${result.touchedTopics.join(', ')}.`
                        : 'Managed auto-memory extraction completed without durable changes.'),
                metadata: {
                    touchedTopics: result.touchedTopics,
                    processedOffset: result.cursor.processedOffset,
                    skippedReason: result.skippedReason,
                },
            });
            if (params.config) {
                logMemoryExtract(params.config, new MemoryExtractEvent({
                    trigger: 'auto',
                    status: 'completed',
                    patches_count: result.touchedTopics.length,
                    touched_topics: result.touchedTopics,
                    duration_ms: durationMs,
                }));
            }
            return result;
        }
        catch (error) {
            const durationMs = Date.now() - t0;
            this.update(record, {
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
            });
            if (params.config) {
                logMemoryExtract(params.config, new MemoryExtractEvent({
                    trigger: 'auto',
                    status: 'failed',
                    patches_count: 0,
                    touched_topics: [],
                    duration_ms: durationMs,
                }));
            }
            throw error;
        }
        finally {
            this.extractCurrentTaskId.delete(params.projectRoot);
            this.extractRunning.delete(params.projectRoot);
            void this.startQueuedExtract(params.projectRoot);
        }
    }
    async startQueuedExtract(projectRoot) {
        if (this.extractRunning.has(projectRoot))
            return;
        const queued = this.extractQueued.get(projectRoot);
        if (!queued)
            return;
        this.extractQueued.delete(projectRoot);
        await this.track(queued.taskId, this.runExtract(queued.taskId, queued.params));
    }
    // ─── Dream ────────────────────────────────────────────────────────────────────
    /**
     * Maybe schedule a managed auto-memory dream (consolidation).
     * Returns immediately if preconditions aren't met (time gate, session count,
     * lock, or duplicate).
     */
    async scheduleDream(params) {
        if (params.config && !params.config.getManagedAutoDreamEnabled()) {
            return { status: 'skipped', skippedReason: 'disabled' };
        }
        const now = params.now ?? new Date();
        const minHours = params.minHoursBetweenDreams ?? DEFAULT_AUTO_DREAM_MIN_HOURS;
        const minSessions = params.minSessionsBetweenDreams ?? DEFAULT_AUTO_DREAM_MIN_SESSIONS;
        await ensureAutoMemoryScaffold(params.projectRoot, now);
        const metadata = await readDreamMetadata(params.projectRoot);
        if (metadata.lastDreamSessionId === params.sessionId) {
            return { status: 'skipped', skippedReason: 'same_session' };
        }
        const elapsedHours = hoursSince(metadata.lastDreamAt, now);
        if (elapsedHours !== null && elapsedHours < minHours) {
            return { status: 'skipped', skippedReason: 'min_hours' };
        }
        // Throttle the expensive session-count filesystem scan.
        // Return a distinct reason so callers can tell the difference between
        // "we know there aren't enough sessions" and "we haven't checked yet".
        const lastScan = this.dreamLastSessionScanAt.get(params.projectRoot) ?? 0;
        if (now.getTime() - lastScan < SESSION_SCAN_INTERVAL_MS) {
            return { status: 'skipped', skippedReason: 'scan_throttled' };
        }
        const lastDreamMs = metadata.lastDreamAt
            ? Date.parse(metadata.lastDreamAt)
            : 0;
        const sessionIds = await this.sessionScanner(params.projectRoot, lastDreamMs, params.sessionId);
        // Record scan time only after we actually performed the filesystem scan.
        this.dreamLastSessionScanAt.set(params.projectRoot, now.getTime());
        if (sessionIds.length < minSessions) {
            return { status: 'skipped', skippedReason: 'min_sessions' };
        }
        if (await dreamLockExists(params.projectRoot)) {
            return { status: 'skipped', skippedReason: 'locked' };
        }
        // Deduplication — only one dream per projectRoot at a time
        const dedupeKey = `${DREAM_TASK_TYPE}:${params.projectRoot}`;
        const existingId = this.dreamInFlightByKey.get(dedupeKey);
        if (existingId) {
            return {
                status: 'skipped',
                skippedReason: 'running',
                taskId: existingId,
            };
        }
        const record = makeTaskRecord('dream', params.projectRoot, params.sessionId);
        this.storeWith(record, {
            status: 'running',
            metadata: { sessionCount: sessionIds.length },
        });
        this.dreamInFlightByKey.set(dedupeKey, record.id);
        const promise = this.track(record.id, this.runDream(record, dedupeKey, params, now));
        return { status: 'scheduled', taskId: record.id, promise };
    }
    async runDream(record, dedupeKey, params, now) {
        try {
            try {
                await acquireDreamLock(params.projectRoot);
            }
            catch (error) {
                if (error.code === 'EEXIST') {
                    this.update(record, {
                        status: 'skipped',
                        progressText: 'Skipped managed auto-memory dream: consolidation lock already exists.',
                        metadata: { skippedReason: 'locked' },
                    });
                    return record;
                }
                throw error;
            }
            try {
                const result = await runManagedAutoMemoryDream(params.projectRoot, now, params.config);
                const nextMetadata = await readDreamMetadata(params.projectRoot);
                nextMetadata.lastDreamAt = now.toISOString();
                nextMetadata.lastDreamSessionId = params.sessionId;
                nextMetadata.updatedAt = now.toISOString();
                await writeDreamMetadata(params.projectRoot, nextMetadata);
                this.update(record, {
                    status: 'completed',
                    progressText: result.systemMessage ?? 'Managed auto-memory dream completed.',
                    metadata: {
                        touchedTopics: result.touchedTopics,
                        dedupedEntries: result.dedupedEntries,
                        lastDreamAt: now.toISOString(),
                    },
                });
            }
            finally {
                await releaseDreamLock(params.projectRoot);
            }
        }
        catch (error) {
            this.update(record, {
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            this.dreamInFlightByKey.delete(dedupeKey);
        }
        return record;
    }
    // ─── Recall ───────────────────────────────────────────────────────────────────
    /** Select and format relevant memory for the given query. */
    recall(projectRoot, query, options = {}) {
        return resolveRelevantAutoMemoryPromptForQuery(projectRoot, query, options);
    }
    // ─── Forget ───────────────────────────────────────────────────────────────────
    /** Select candidate memory entries matching the given query (step 1 of forget). */
    selectForgetCandidates(projectRoot, query, options = {}) {
        return selectManagedAutoMemoryForgetCandidates(projectRoot, query, options);
    }
    /** Remove the selected memory entries (step 2 of forget). */
    forgetMatches(projectRoot, matches, now) {
        return forgetManagedAutoMemoryMatches(projectRoot, matches, now);
    }
    /** Convenience: select + remove in a single call. */
    forget(projectRoot, query, options = {}, now) {
        return forgetManagedAutoMemoryEntries(projectRoot, query, options, now);
    }
    // ─── Status ───────────────────────────────────────────────────────────────────
    /** Return a full status snapshot for the given project's memory. */
    getStatus(projectRoot) {
        return getManagedAutoMemoryStatus(projectRoot, this);
    }
    // ─── Prompt append ────────────────────────────────────────────────────────────
    /** Append the managed auto-memory section to a user memory string. */
    appendToUserMemory(userMemory, memoryDir, indexContent) {
        return appendManagedAutoMemoryToUserMemory(userMemory, memoryDir, indexContent);
    }
    // ─── Dream utilities ──────────────────────────────────────────────────────────
    /**
     * Record that a manual dream run has completed for the given session.
     * Call this from the dreamCommand's onComplete callback.
     */
    writeDreamManualRun(projectRoot, sessionId, now) {
        return writeDreamManualRunToMetadata(projectRoot, sessionId, now);
    }
    /**
     * Build the consolidation task prompt used by the dream slash command.
     * Returns a prompt string describing what the agent should do.
     */
    buildConsolidationPrompt(memoryRoot, transcriptDir) {
        return buildConsolidationTaskPrompt(memoryRoot, transcriptDir);
    }
    // ─── Test helpers ─────────────────────────────────────────────────────────────
    /** Reset all extract scheduling state. Call from afterEach in tests. */
    resetExtractStateForTests() {
        this.extractRunning.clear();
        this.extractCurrentTaskId.clear();
        this.extractQueued.clear();
    }
    /** Reset all dream scheduling state. */
    resetDreamStateForTests() {
        this.dreamInFlightByKey.clear();
        this.dreamLastSessionScanAt.clear();
    }
}
/**
 * Application-wide singleton. In a fully wired application Config creates its
 * own MemoryManager accessible via `config.getMemoryManager()`.
 */
export const globalMemoryManager = new MemoryManager();
//# sourceMappingURL=manager.js.map