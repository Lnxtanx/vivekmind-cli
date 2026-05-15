/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { Storage } from '../config/storage.js';
import { getProjectHash } from '../utils/paths.js';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import * as jsonl from '../utils/jsonl-utils.js';
import { uiTelemetryService } from '../telemetry/uiTelemetry.js';
import { createDebugLogger } from '../utils/debugLogger.js';
import { readLastJsonStringFieldSync, readLastJsonStringFieldsSync, } from '../utils/sessionStorageUtils.js';
const debugLogger = createDebugLogger('SESSION');
/**
 * Maximum number of files to process when listing sessions.
 * This is a safety limit to prevent performance issues with very large chat directories.
 */
const MAX_FILES_TO_PROCESS = 10000;
/**
 * Maximum character length for a session custom title.
 * Shared across CLI, WebUI, VSCode, and ACP.
 */
export const SESSION_TITLE_MAX_LENGTH = 200;
/**
 * Pattern for validating session file names.
 * Session files are named as `${sessionId}.jsonl` where sessionId is a UUID-like identifier
 * (32-36 hex characters, optionally with hyphens).
 */
const SESSION_FILE_PATTERN = /^[0-9a-fA-F-]{32,36}\.jsonl$/;
/** Maximum number of lines to scan when looking for the first prompt text. */
const MAX_PROMPT_SCAN_LINES = 10;
/**
 * Maximum bytes to read from head/tail of a session file.
 * Used by readLastRecordUuid which still does its own tail read.
 */
const TAIL_READ_SIZE = 64 * 1024;
/**
 * Service for managing chat sessions.
 *
 * This service handles:
 * - Listing sessions with pagination (ordered by mtime)
 * - Loading full session data for resumption
 * - Removing sessions
 *
 * Sessions are stored as JSONL files, one per session.
 * File location: ~/.vivekmind/tmp/<project_id>/chats/
 */
export class SessionService {
    storage;
    projectHash;
    constructor(cwd) {
        this.storage = new Storage(cwd);
        this.projectHash = getProjectHash(cwd);
    }
    getChatsDir() {
        return path.join(this.storage.getProjectDir(), 'chats');
    }
    /**
     * Reads the session title from a JSONL file.
     *
     * Delegates to {@link readLastJsonStringFieldSync}, which scans the tail
     * window first (fast path; almost always hits because finalize() re-appends
     * the title on every lifecycle event) and falls back to a full-file scan
     * when the tail has no match. The `custom_title` line-marker guards against
     * false matches from user content that happens to include a `customTitle`
     * field.
     */
    readSessionTitleFromFile(filePath) {
        // Match only on actual custom_title system records. `'custom_title'` as
        // a loose substring can land on a user message that happens to contain
        // the literal "custom_title" (code review of this very file, etc.);
        // requiring the full `"subtype":"custom_title"` pattern guarantees the
        // match is on a system record written by {@link writeLineSync}, which
        // JSON.stringifies records in a predictable compact form.
        return readLastJsonStringFieldSync(filePath, 'customTitle', '"subtype":"custom_title"');
    }
    /**
     * Reads both the custom title and its source from a session file in a
     * single pass — the helper extracts both fields from the same matching
     * `custom_title` line, so the pair is always consistent (never one field
     * from an old record and another from a new one).
     *
     * `titleSource` is absent on legacy records written before the field was
     * introduced — callers treat `undefined` as equivalent to `'manual'` so a
     * user's pre-upgrade rename is never displayed as if it were auto-generated.
     */
    readSessionTitleInfoFromFile(filePath) {
        const hit = readLastJsonStringFieldsSync(filePath, 'customTitle', ['titleSource'], '"subtype":"custom_title"');
        const title = hit['customTitle'];
        if (!title)
            return {};
        const rawSource = hit['titleSource'];
        const source = rawSource === 'auto' || rawSource === 'manual' ? rawSource : undefined;
        return { title, source };
    }
    /**
     * Public accessor: returns both the current custom title and its source
     * for a given session. Used by `ChatRecordingService` on resume to
     * preserve the persisted `titleSource` rather than defaulting to manual.
     */
    getSessionTitleInfo(sessionId) {
        if (!SESSION_FILE_PATTERN.test(`${sessionId}.jsonl`)) {
            return {};
        }
        const chatsDir = this.getChatsDir();
        const filePath = path.join(chatsDir, `${sessionId}.jsonl`);
        return this.readSessionTitleInfoFromFile(filePath);
    }
    /**
     * Reads the UUID of the last record in a session JSONL file.
     * Uses a tail-read strategy for efficiency.
     */
    readLastRecordUuid(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            const readStart = Math.max(0, fileSize - TAIL_READ_SIZE);
            const readLength = Math.min(fileSize, TAIL_READ_SIZE);
            const fd = fs.openSync(filePath, 'r');
            let buffer;
            try {
                buffer = Buffer.alloc(readLength);
                fs.readSync(fd, buffer, 0, readLength, readStart);
            }
            finally {
                fs.closeSync(fd);
            }
            const tail = buffer.toString('utf-8');
            const lines = tail.split('\n');
            // Walk backwards to find the last valid record
            for (let i = lines.length - 1; i >= 0; i--) {
                const trimmed = lines[i].trim();
                if (!trimmed)
                    continue;
                try {
                    const record = JSON.parse(trimmed);
                    if (record.uuid) {
                        return record.uuid;
                    }
                }
                catch {
                    continue;
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Extracts the first user prompt text from a Content object.
     */
    extractPromptText(message) {
        if (!message?.parts)
            return '';
        for (const part of message.parts) {
            if ('text' in part) {
                const textPart = part;
                const text = textPart.text;
                // Truncate long prompts for display
                return text.length > 200 ? `${text.slice(0, 200)}...` : text;
            }
        }
        return '';
    }
    /**
     * Finds the first available prompt text by scanning the first N records,
     * preferring user messages. Returns an empty string if none found.
     */
    extractFirstPromptFromRecords(records) {
        for (const record of records) {
            if (record.type !== 'user')
                continue;
            const prompt = this.extractPromptText(record.message);
            if (prompt)
                return prompt;
        }
        return '';
    }
    /**
     * Counts unique message UUIDs in a session file.
     * This gives the number of logical messages in the session.
     */
    async countSessionMessages(filePath) {
        const uniqueUuids = new Set();
        try {
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity,
            });
            for await (const line of rl) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const record = JSON.parse(trimmed);
                    if (record.type === 'user' || record.type === 'assistant') {
                        uniqueUuids.add(record.uuid);
                    }
                }
                catch {
                    // Ignore malformed lines
                    continue;
                }
            }
            return uniqueUuids.size;
        }
        catch {
            return 0;
        }
    }
    /**
     * Lists sessions for the current project with pagination.
     *
     * Sessions are ordered by file modification time (most recent first).
     * Uses cursor-based pagination with mtime as the cursor.
     *
     * Only reads the first line of each JSONL file for efficiency.
     * Files are filtered by UUID pattern first, then by project hash.
     *
     * @param options Pagination options
     * @returns Paginated list of sessions
     */
    async listSessions(options = {}) {
        const { cursor, size = 20 } = options;
        const chatsDir = this.getChatsDir();
        // Get all valid session files (matching UUID pattern) with their stats
        let files = [];
        try {
            const fileNames = fs.readdirSync(chatsDir);
            for (const name of fileNames) {
                // Only process files matching session file pattern
                if (!SESSION_FILE_PATTERN.test(name))
                    continue;
                const filePath = path.join(chatsDir, name);
                try {
                    const stats = fs.statSync(filePath);
                    files.push({ name, mtime: stats.mtimeMs });
                }
                catch {
                    // Skip files we can't stat
                    continue;
                }
            }
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return { items: [], hasMore: false };
            }
            throw error;
        }
        // Sort by mtime descending (most recent first)
        files.sort((a, b) => b.mtime - a.mtime);
        // Apply cursor filter (items with mtime < cursor)
        if (cursor !== undefined) {
            files = files.filter((f) => f.mtime < cursor);
        }
        // Iterate through files until we have enough matching ones.
        // Different projects may share the same chats directory due to path sanitization,
        // so we need to filter by project hash and continue until we have enough items.
        const items = [];
        let filesProcessed = 0;
        let lastProcessedMtime;
        let hasMoreFiles = false;
        for (const file of files) {
            // Safety limit to prevent performance issues
            if (filesProcessed >= MAX_FILES_TO_PROCESS) {
                hasMoreFiles = true;
                break;
            }
            // Stop if we have enough items
            if (items.length >= size) {
                hasMoreFiles = true;
                break;
            }
            filesProcessed++;
            lastProcessedMtime = file.mtime;
            const filePath = path.join(chatsDir, file.name);
            const records = await jsonl.readLines(filePath, MAX_PROMPT_SCAN_LINES);
            if (records.length === 0)
                continue;
            const firstRecord = records[0];
            // Skip if not matching current project
            // We use cwd comparison since first record doesn't have projectHash
            const recordProjectHash = getProjectHash(firstRecord.cwd);
            if (recordProjectHash !== this.projectHash)
                continue;
            // Count messages for this session
            const messageCount = await this.countSessionMessages(filePath);
            const prompt = this.extractFirstPromptFromRecords(records);
            const titleInfo = this.readSessionTitleInfoFromFile(filePath);
            items.push({
                sessionId: firstRecord.sessionId,
                cwd: firstRecord.cwd,
                startTime: firstRecord.timestamp,
                mtime: file.mtime,
                prompt,
                gitBranch: firstRecord.gitBranch,
                filePath,
                messageCount,
                customTitle: titleInfo.title,
                titleSource: titleInfo.source,
            });
        }
        // Determine next cursor (mtime of last processed file)
        // Only set if there are more files to process
        const nextCursor = hasMoreFiles && lastProcessedMtime !== undefined
            ? lastProcessedMtime
            : undefined;
        return {
            items,
            nextCursor,
            hasMore: hasMoreFiles,
        };
    }
    /**
     * Reads all records from a session file.
     */
    async readAllRecords(filePath) {
        try {
            return await jsonl.read(filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                debugLogger.error('Error reading session file:', error);
            }
            return [];
        }
    }
    /**
     * Aggregates multiple records with the same uuid into a single ChatRecord.
     * Merges content fields (message, tokens, model, toolCallResult).
     */
    aggregateRecords(records) {
        if (records.length === 0) {
            throw new Error('Cannot aggregate empty records array');
        }
        const base = { ...records[0] };
        for (let i = 1; i < records.length; i++) {
            const record = records[i];
            // Merge message (Content objects)
            if (record.message !== undefined) {
                if (base.message === undefined) {
                    base.message = record.message;
                }
                else {
                    base.message = {
                        role: base.message.role,
                        parts: [
                            ...(base.message.parts || []),
                            ...(record.message.parts || []),
                        ],
                    };
                }
            }
            // Merge tokens (take the latest)
            if (record.usageMetadata) {
                base.usageMetadata = record.usageMetadata;
            }
            // Merge toolCallResult
            if (record.toolCallResult && !base.toolCallResult) {
                base.toolCallResult = record.toolCallResult;
            }
            // Merge model (take the first non-empty one)
            if (record.model && !base.model) {
                base.model = record.model;
            }
            // Update timestamp to the latest
            if (record.timestamp > base.timestamp) {
                base.timestamp = record.timestamp;
            }
        }
        return base;
    }
    /**
     * Reconstructs a linear conversation from tree-structured records.
     */
    reconstructHistory(records, leafUuid) {
        if (records.length === 0)
            return [];
        const recordsByUuid = new Map();
        for (const record of records) {
            const existing = recordsByUuid.get(record.uuid) || [];
            existing.push(record);
            recordsByUuid.set(record.uuid, existing);
        }
        let currentUuid = leafUuid ?? records[records.length - 1].uuid;
        const uuidChain = [];
        const visited = new Set();
        while (currentUuid && !visited.has(currentUuid)) {
            visited.add(currentUuid);
            uuidChain.push(currentUuid);
            const recordsForUuid = recordsByUuid.get(currentUuid);
            if (!recordsForUuid || recordsForUuid.length === 0)
                break;
            currentUuid = recordsForUuid[0].parentUuid;
        }
        uuidChain.reverse();
        const messages = [];
        for (const uuid of uuidChain) {
            const recordsForUuid = recordsByUuid.get(uuid);
            if (recordsForUuid && recordsForUuid.length > 0) {
                messages.push(this.aggregateRecords(recordsForUuid));
            }
        }
        return messages;
    }
    /**
     * Loads a session by its session ID.
     * Reconstructs the full conversation from tree-structured records.
     *
     * @param sessionId The session ID to load
     * @returns Session data for resumption, or null if not found
     */
    async loadSession(sessionId) {
        const chatsDir = this.getChatsDir();
        const filePath = path.join(chatsDir, `${sessionId}.jsonl`);
        const records = await this.readAllRecords(filePath);
        if (records.length === 0) {
            return;
        }
        // Verify this session belongs to the current project
        const firstRecord = records[0];
        const recordProjectHash = getProjectHash(firstRecord.cwd);
        if (recordProjectHash !== this.projectHash) {
            return;
        }
        // Reconstruct linear history
        const messages = this.reconstructHistory(records);
        if (messages.length === 0) {
            return;
        }
        const lastMessage = messages[messages.length - 1];
        const stats = fs.statSync(filePath);
        const conversation = {
            sessionId: firstRecord.sessionId,
            projectHash: this.projectHash,
            startTime: firstRecord.timestamp,
            lastUpdated: new Date(stats.mtimeMs).toISOString(),
            messages,
        };
        return {
            conversation,
            filePath,
            lastCompletedUuid: lastMessage.uuid,
        };
    }
    /**
     * Removes a session by its session ID.
     *
     * @param sessionId The session ID to remove
     * @returns true if removed, false if not found
     */
    async removeSession(sessionId) {
        if (!SESSION_FILE_PATTERN.test(`${sessionId}.jsonl`)) {
            return false;
        }
        const chatsDir = this.getChatsDir();
        const filePath = path.join(chatsDir, `${sessionId}.jsonl`);
        try {
            // Verify the file exists and belongs to this project
            const records = await jsonl.readLines(filePath, 1);
            if (records.length === 0) {
                return false;
            }
            const recordProjectHash = getProjectHash(records[0].cwd);
            if (recordProjectHash !== this.projectHash) {
                return false;
            }
            fs.unlinkSync(filePath);
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }
    /**
     * Renames a session by appending a custom_title system record to its JSONL file.
     *
     * @param sessionId The session ID to rename
     * @param title The new custom title
     * @param titleSource Where the title came from. Defaults to `'manual'` so
     *   existing callers are unchanged — pass `'auto'` only for titles produced
     *   by the auto-title generator.
     * @returns true if renamed successfully, false if session not found
     */
    async renameSession(sessionId, title, titleSource = 'manual') {
        if (!SESSION_FILE_PATTERN.test(`${sessionId}.jsonl`)) {
            return false;
        }
        const chatsDir = this.getChatsDir();
        const filePath = path.join(chatsDir, `${sessionId}.jsonl`);
        try {
            // Verify the file exists and belongs to this project
            const records = await jsonl.readLines(filePath, 1);
            if (records.length === 0) {
                return false;
            }
            const recordProjectHash = getProjectHash(records[0].cwd);
            if (recordProjectHash !== this.projectHash) {
                return false;
            }
            // Read the last record's UUID so the custom_title record is properly
            // chained into the parent history.  reconstructHistory() walks from the
            // tail record upward via parentUuid; a null parentUuid would sever the
            // chain and cause the session to appear empty on next load.
            const lastUuid = this.readLastRecordUuid(filePath);
            // Append a custom_title system record. `renameSession` is the
            // fallback path when no live recording service is attached (e.g., from
            // the WebUI or VSCode extension). Callers pass `titleSource='auto'`
            // only when the title came from the auto-generator; defaults to
            // 'manual' for explicit user renames.
            const titleRecord = {
                uuid: randomUUID(),
                parentUuid: lastUuid,
                sessionId,
                timestamp: new Date().toISOString(),
                type: 'system',
                subtype: 'custom_title',
                cwd: records[0].cwd,
                version: records[0].version,
                systemPayload: { customTitle: title, titleSource },
            };
            jsonl.writeLineSync(filePath, titleRecord);
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }
    /**
     * Gets the custom title for a session by reading from its JSONL file.
     *
     * @param sessionId The session ID to look up
     * @returns The custom title, or undefined if none set
     */
    getSessionTitle(sessionId) {
        if (!SESSION_FILE_PATTERN.test(`${sessionId}.jsonl`)) {
            return undefined;
        }
        const chatsDir = this.getChatsDir();
        const filePath = path.join(chatsDir, `${sessionId}.jsonl`);
        return this.readSessionTitleFromFile(filePath);
    }
    /**
     * Finds sessions by custom title.
     * Returns all matching sessions ordered by most recent first.
     *
     * @param title The custom title to search for (case-insensitive exact match)
     * @returns Array of matching session list items
     */
    async findSessionsByTitle(title) {
        const normalizedTitle = title.toLowerCase().trim();
        const matches = [];
        const chatsDir = this.getChatsDir();
        // Scan all session files directly rather than paging through
        // listSessions(): the mtime-only cursor there uses a strict `<` boundary,
        // so sessions that share an mtime with the page's last entry are skipped,
        // which would silently drop valid title matches.
        let fileNames;
        try {
            fileNames = fs.readdirSync(chatsDir);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return matches;
            }
            throw error;
        }
        const files = [];
        for (const name of fileNames) {
            if (!SESSION_FILE_PATTERN.test(name))
                continue;
            const filePath = path.join(chatsDir, name);
            try {
                const stats = fs.statSync(filePath);
                files.push({ name, mtime: stats.mtimeMs });
            }
            catch {
                continue;
            }
        }
        // Sort most-recent first, with filename as a stable tie-breaker so runs
        // are deterministic even when multiple files share an mtime.
        files.sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
        let filesProcessed = 0;
        for (const file of files) {
            if (filesProcessed >= MAX_FILES_TO_PROCESS)
                break;
            filesProcessed++;
            const filePath = path.join(chatsDir, file.name);
            // Cheap check first: tail-read the title and skip non-matches before
            // doing the full hydration work (first-record read, project filter,
            // message count, prompt extraction).
            const titleInfo = this.readSessionTitleInfoFromFile(filePath);
            if (titleInfo.title?.toLowerCase().trim() !== normalizedTitle)
                continue;
            const records = await jsonl.readLines(filePath, MAX_PROMPT_SCAN_LINES);
            if (records.length === 0)
                continue;
            const firstRecord = records[0];
            const recordProjectHash = getProjectHash(firstRecord.cwd);
            if (recordProjectHash !== this.projectHash)
                continue;
            const messageCount = await this.countSessionMessages(filePath);
            const prompt = this.extractFirstPromptFromRecords(records);
            matches.push({
                sessionId: firstRecord.sessionId,
                cwd: firstRecord.cwd,
                startTime: firstRecord.timestamp,
                mtime: file.mtime,
                prompt,
                gitBranch: firstRecord.gitBranch,
                filePath,
                messageCount,
                customTitle: titleInfo.title,
                titleSource: titleInfo.source,
            });
        }
        return matches;
    }
    /**
     * Loads the most recent session for the current project.
     * Combines listSessions and loadSession for convenience.
     *
     * @returns Session data for resumption, or undefined if no sessions exist
     */
    async loadLastSession() {
        const result = await this.listSessions({ size: 1 });
        if (result.items.length === 0) {
            return;
        }
        return this.loadSession(result.items[0].sessionId);
    }
    /**
     * Checks if a session exists by its session ID.
     *
     * @param sessionId The session ID to check
     * @returns true if session exists and belongs to current project
     */
    async sessionExists(sessionId) {
        if (!SESSION_FILE_PATTERN.test(`${sessionId}.jsonl`)) {
            return false;
        }
        const chatsDir = this.getChatsDir();
        const filePath = path.join(chatsDir, `${sessionId}.jsonl`);
        try {
            const records = await jsonl.readLines(filePath, 1);
            if (records.length === 0) {
                return false;
            }
            const recordProjectHash = getProjectHash(records[0].cwd);
            return recordProjectHash === this.projectHash;
        }
        catch {
            return false;
        }
    }
}
/**
 * Strips thought parts from a Content object.
 * Thought parts are identified by having `thought: true`.
 * Returns null if the content only contained thought parts.
 */
function stripThoughtsFromContent(content) {
    if (!content.parts)
        return content;
    const filteredParts = content.parts.filter((part) => !part.thought);
    // If all parts were thoughts, remove the entire content
    if (filteredParts.length === 0) {
        return null;
    }
    return {
        ...content,
        parts: filteredParts,
    };
}
/**
 * Builds the model-facing chat history (Content[]) from a reconstructed
 * conversation. This keeps UI history intact while applying chat compression
 * checkpoints for the API history used on resume.
 *
 * Strategy:
 * - Find the latest system/chat_compression record (if any).
 * - Use its compressedHistory snapshot as the base history.
 * - Append all messages after that checkpoint (skipping system records).
 * - If no checkpoint exists, return the linear message list (message field only).
 */
export function buildApiHistoryFromConversation(conversation, options = {}) {
    const { stripThoughtsFromHistory = false } = options;
    const { messages } = conversation;
    let lastCompressionIndex = -1;
    let compressedHistory;
    messages.forEach((record, index) => {
        if (record.type === 'system' && record.subtype === 'chat_compression') {
            const payload = record.systemPayload;
            if (payload?.compressedHistory) {
                lastCompressionIndex = index;
                compressedHistory = payload.compressedHistory;
            }
        }
    });
    if (compressedHistory && lastCompressionIndex >= 0) {
        const baseHistory = structuredClone(compressedHistory);
        // Append everything after the compression record (newer turns)
        for (let i = lastCompressionIndex + 1; i < messages.length; i++) {
            const record = messages[i];
            if (record.type === 'system')
                continue;
            if (record.message) {
                baseHistory.push(structuredClone(record.message));
            }
        }
        if (stripThoughtsFromHistory) {
            return baseHistory
                .map(stripThoughtsFromContent)
                .filter((content) => content !== null);
        }
        return baseHistory;
    }
    // Fallback: return linear messages as Content[]
    const result = messages
        .map((record) => record.message)
        .filter((message) => message !== undefined)
        .map((message) => structuredClone(message));
    if (stripThoughtsFromHistory) {
        return result
            .map(stripThoughtsFromContent)
            .filter((content) => content !== null);
    }
    return result;
}
/**
 * Replays stored UI telemetry events to rebuild metrics when resuming a session.
 * Also restores the last prompt token count from the best available source.
 */
export function replayUiTelemetryFromConversation(conversation) {
    uiTelemetryService.reset();
    for (const record of conversation.messages) {
        if (record.type !== 'system' || record.subtype !== 'ui_telemetry') {
            continue;
        }
        const payload = record.systemPayload;
        const uiEvent = payload?.uiEvent;
        if (uiEvent) {
            uiTelemetryService.addEvent(uiEvent);
        }
    }
    const resumePromptTokens = getResumePromptTokenCount(conversation);
    if (resumePromptTokens !== undefined) {
        uiTelemetryService.setLastPromptTokenCount(resumePromptTokens);
    }
}
/**
 * Returns the best available prompt token count for resuming telemetry.
 * Walks backward through messages and returns the first valid value:
 * - The latest assistant's non-zero usage (totalTokenCount ?? promptTokenCount).
 * - The most recent chat compression checkpoint's newTokenCount.
 */
export function getResumePromptTokenCount(conversation) {
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
        const record = conversation.messages[i];
        if (record.type === 'assistant') {
            const usage = record.usageMetadata;
            const candidate = usage?.totalTokenCount ?? usage?.promptTokenCount;
            if (candidate) {
                return candidate;
            }
        }
        if (record.type === 'system' && record.subtype === 'chat_compression') {
            const payload = record.systemPayload;
            if (payload?.info) {
                return payload.info.newTokenCount;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=sessionService.js.map