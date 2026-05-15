/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Config } from '../config/config.js';
import { type PartListUnion, type Content, type FunctionDeclaration, type GenerateContentResponseUsageMetadata } from '@google/genai';
import type { ChatCompressionInfo, ToolCallResponseInfo } from '../core/turn.js';
import type { Status } from '../core/coreToolScheduler.js';
import type { UiEvent } from '../telemetry/uiTelemetry.js';
/**
 * A single record stored in the JSONL file.
 * Forms a tree structure via uuid/parentUuid for future checkpointing support.
 *
 * Each record is self-contained with full metadata, enabling:
 * - Append-only writes (crash-safe)
 * - Tree reconstruction by following parentUuid chain
 * - Future checkpointing by branching from any historical record
 */
export interface ChatRecord {
    /** Unique identifier for this logical message */
    uuid: string;
    /** UUID of the parent message; null for root (first message in session) */
    parentUuid: string | null;
    /** Session identifier - groups records into a logical conversation */
    sessionId: string;
    /** ISO 8601 timestamp of when the record was created */
    timestamp: string;
    /**
     * Message type: user input, assistant response, tool result, or system event.
     * System records are append-only events that can alter how history is reconstructed
     * (e.g., chat compression checkpoints) while keeping the original UI history intact.
     */
    type: 'user' | 'assistant' | 'tool_result' | 'system';
    /** Optional system subtype for distinguishing system behaviors */
    subtype?: 'chat_compression' | 'slash_command' | 'ui_telemetry' | 'at_command' | 'notification' | 'cron' | 'custom_title' | 'rewind' | 'agent_bootstrap' | 'agent_launch_prompt';
    /** Working directory at time of message */
    cwd: string;
    /** CLI version for compatibility tracking */
    version: string;
    /** Current git branch, if available */
    gitBranch?: string;
    /**
     * The actual Content object (role + parts) sent to/from LLM.
     * This is stored in the exact format needed for API calls, enabling
     * direct aggregation into Content[] for session resumption.
     * Contains: text, functionCall, functionResponse, thought parts, etc.
     */
    message?: Content;
    /** Token usage statistics */
    usageMetadata?: GenerateContentResponseUsageMetadata;
    /** Model used for this response */
    model?: string;
    /** Context window size of the model used for this response */
    contextWindowSize?: number;
    /**
     * Tool call metadata for UI recovery.
     * Contains enriched info (displayName, status, result, etc.) not in API format.
     */
    toolCallResult?: Partial<ToolCallResponseInfo>;
    /**
     * Payload for system records. For chat compression, this stores all data needed
     * to reconstruct the compressed history without mutating the original UI list.
     */
    systemPayload?: ChatCompressionRecordPayload | SlashCommandRecordPayload | UiTelemetryRecordPayload | AtCommandRecordPayload | CustomTitleRecordPayload | NotificationRecordPayload | RewindRecordPayload | AgentBootstrapRecordPayload;
    /** Background subagent that produced this record (e.g. "explore-7f3c"). */
    agentId?: string;
    /** Display name for the subagent (e.g. "Explore"). */
    agentName?: string;
    /** UI hint for tools rendering subagent transcripts. */
    agentColor?: string;
    /** True for records produced by a subagent (a sidechain off the parent session). */
    isSidechain?: boolean;
}
export interface NotificationRecordPayload {
    displayText: string;
}
export interface AgentBootstrapRecordPayload {
    /** Bootstrap kind for future-proof decoding. */
    kind: 'fork';
    /**
     * Exact model-facing history prefix seeded before the agent emitted any
     * runtime events. For forks, this includes the inherited parent context and
     * the original first task prompt/user turn.
     */
    history: Content[];
    /**
     * Immutable launch-time system instruction for the fork runtime. Resume must
     * reuse this exact value rather than reading the current parent config.
     */
    systemInstruction?: string | Content;
    /**
     * Immutable launch-time tool declarations / allowlist for the fork runtime.
     * Resume must reuse this exact capability set or stay blocked.
     */
    tools?: Array<string | FunctionDeclaration>;
}
/**
 * Stored payload for chat compression checkpoints. This allows us to rebuild the
 * effective chat history on resume while keeping the original UI-visible history.
 */
export interface ChatCompressionRecordPayload {
    /** Compression metrics/status returned by the compression service */
    info: ChatCompressionInfo;
    /**
     * Snapshot of the new history contents that the model should see after
     * compression (summary turns + retained tail). Stored as Content[] for
     * resume reconstruction.
     */
    compressedHistory: Content[];
}
export interface SlashCommandRecordPayload {
    /** Whether this record represents the invocation or the resulting output. */
    phase: 'invocation' | 'result';
    /** Raw user-entered slash command (e.g., "/about"). */
    rawCommand: string;
    /**
     * History items the UI displayed for this command, in the same shape used by
     * the CLI (without IDs). Stored as plain objects for replay on resume.
     */
    outputHistoryItems?: Array<Record<string, unknown>>;
}
/**
 * Stored payload for @-command replay.
 */
export interface AtCommandRecordPayload {
    /** Files that were read for this @-command. */
    filesRead: string[];
    /** Status for UI reconstruction. */
    status: 'success' | 'error';
    /** Optional result message for UI reconstruction. */
    message?: string;
    /** Raw user-entered @-command query (optional for legacy records). */
    userText?: string;
}
/**
 * Source of a custom session title.
 * - `manual`: set by the user via `/rename` (or pre-2026 records without
 *   a source field — treated as manual for safety so auto can't overwrite
 *   a title a user deliberately chose).
 * - `auto`: generated by the session-title service from conversation text;
 *   safe to re-generate or be replaced by a manual rename.
 */
export type TitleSource = 'manual' | 'auto';
/**
 * Stored payload for custom title set via /rename or auto-generation.
 */
export interface CustomTitleRecordPayload {
    /** The custom title for the session */
    customTitle: string;
    /**
     * How this title was produced. Absent on legacy records — readers should
     * treat `undefined` as `'manual'` so existing user-set titles are never
     * replaced by auto-generation after an upgrade.
     */
    titleSource?: TitleSource;
}
/**
 * Stored payload for UI telemetry replay.
 */
export interface UiTelemetryRecordPayload {
    uiEvent: UiEvent;
}
/**
 * Stored payload for conversation rewind events.
 */
export interface RewindRecordPayload {
    /** Number of UI history items truncated. */
    truncatedCount: number;
}
/**
 * Service for recording the current chat session to disk.
 *
 * This service provides comprehensive conversation recording that captures:
 * - All user and assistant messages
 * - Tool calls and their execution results
 * - Token usage statistics
 * - Assistant thoughts and reasoning
 *
 * **API Design:**
 * - `recordUserMessage()` - Records a user message (immediate write)
 * - `recordAssistantTurn()` - Records an assistant turn with all data (immediate write)
 * - `recordToolResult()` - Records tool results (immediate write)
 *
 * **Storage Format:** JSONL files with tree-structured records.
 * Each record has uuid/parentUuid fields enabling:
 * - Append-only writes (never rewrite the file)
 * - Linear history reconstruction
 * - Future checkpointing (branch from any historical point)
 *
 * File location: ~/.vivekmind/tmp/<project_id>/chats/
 *
 * For session management (list, load, remove), use SessionService.
 */
export declare class ChatRecordingService {
    /** UUID of the last written record in the chain */
    private lastRecordUuid;
    private readonly config;
    /**
     * Tracks the `lastRecordUuid` value just before each user turn was recorded.
     * Used by {@link rewindRecording} to re-root the parentUuid chain so that
     * rewound messages end up on a dead branch in the tree, making
     * `reconstructHistory()` skip them automatically on resume.
     *
     * Index `i` holds the UUID of the last record written before the (i+1)th
     * user message was appended. For example, `turnParentUuids[0]` is the UUID
     * right before the very first user message (often `null` or the startup
     * context record).
     */
    private turnParentUuids;
    /**
     * Cached chats-dir / conversation-file path so per-record appendRecord
     * doesn't re-stat them on every write. The first call performs the
     * mkdir / wx-create; subsequent calls short-circuit.
     */
    private chatsDirEnsured;
    private cachedConversationFile;
    /**
     * Serialized async write queue for appendRecord. We update lastRecordUuid
     * synchronously so the next createBaseRecord sees the right parentUuid,
     * but the actual fs write runs in this chain so the event loop is not
     * blocked. Must be flushed before process exit (see {@link flush}).
     */
    private writeChain;
    /** In-memory cache of the current session's custom title (for re-append on exit) */
    private currentCustomTitle;
    /**
     * Source of {@link currentCustomTitle}. `undefined` on legacy records that
     * pre-date the `titleSource` field — that's treated as manual everywhere
     * (safe default) without rewriting the persisted record.
     */
    private currentTitleSource;
    /**
     * How many auto-title attempts have been made this process.
     *
     * We don't commit to "one attempt per session" because the first assistant
     * turn may be a pure tool-call with no user-visible text (e.g., the model
     * opens with a search) — the title service returns null, and we'd waste
     * the whole session's chance on a turn that never had a shot. Instead we
     * retry for a handful of turns until either the title lands or we hit the
     * cap, which protects against a persistently failing fast-model looping
     * on every turn. {@link AUTO_TITLE_ATTEMPT_CAP} sets the ceiling.
     */
    private autoTitleAttempts;
    /**
     * AbortController for the in-flight auto-title LLM call, or `undefined`
     * when no generation is pending. Doubles as the in-flight guard — a
     * defined controller means "one is running; don't launch another".
     * Stored on the instance so {@link finalize} (called on session switch
     * and shutdown) can cancel a pending call cleanly rather than letting
     * it burn tokens after the session has already moved on.
     */
    private autoTitleController;
    constructor(config: Config);
    /**
     * Returns the current custom title, if any. Read-only accessor for
     * callers (e.g. auto-title trigger) that need to know whether a title is
     * already set before attempting generation.
     */
    getCurrentCustomTitle(): string | undefined;
    /**
     * Returns the source of the current custom title, or `undefined` when no
     * title is set.
     */
    getCurrentTitleSource(): TitleSource | undefined;
    /**
     * Returns the session ID.
     * @returns The session ID.
     */
    private getSessionId;
    /**
     * Ensures the chats directory exists, creating it if it doesn't exist.
     * @returns The path to the chats directory.
     * @throws Error if the directory cannot be created.
     */
    private ensureChatsDir;
    /**
     * Ensures the conversation file exists, creating it if it doesn't exist.
     * Uses atomic file creation to avoid race conditions. Result is cached so
     * subsequent appendRecord calls skip the wx-create entirely.
     * @returns The path to the conversation file.
     * @throws Error if the file cannot be created or accessed.
     */
    private ensureConversationFile;
    /**
     * Creates base fields for a ChatRecord.
     */
    private createBaseRecord;
    /**
     * Appends a record to the session file and updates lastRecordUuid.
     *
     * lastRecordUuid is updated synchronously so the next createBaseRecord sees
     * the correct parentUuid without waiting for the previous write. The actual
     * fs write is enqueued on {@link writeChain} and runs async; per-file
     * mutex inside {@link jsonl.writeLine} preserves on-disk ordering.
     *
     * **Known tradeoff (parentUuid chain integrity on write failure):** if the
     * enqueued write rejects (e.g., disk full, permission dropped), the error
     * is logged but subsequent records still claim the failed record's uuid
     * as their parent. On resume, readers that walk parentUuid (e.g.
     * sessionService.reconstructHistory) will silently drop records whose
     * ancestor is missing on disk. This matches the sync version's behavior
     * when its own throw was caught and logged by the caller — under normal
     * local-disk writes failures are rare enough to accept the fire-and-forget
     * simplification.
     */
    private appendRecord;
    /**
     * Awaits all queued async writes. Call before process exit / session
     * teardown to ensure no records are dropped.
     */
    flush(): Promise<void>;
    /**
     * Records a user message.
     * Writes immediately to disk.
     *
     * @param message The raw PartListUnion object as used with the API
     */
    recordUserMessage(message: PartListUnion): void;
    /**
     * Records a cron-fired prompt.
     * Stored as a user-role message with subtype 'cron' so the UI
     * restores it as a notification item instead of a user turn.
     */
    recordCronPrompt(message: PartListUnion, displayText?: string): void;
    /**
     * Records a background agent notification.
     * Stored as a user-role message with subtype 'notification' so the
     * UI restores it as an info item, not a user turn.
     */
    recordNotification(message: PartListUnion, displayText?: string): void;
    private recordNotificationLike;
    /**
     * Records an assistant turn with all available data.
     * Writes immediately to disk.
     *
     * @param data.message The raw PartListUnion object from the model response
     * @param data.model The model name
     * @param data.tokens Token usage statistics
     * @param data.contextWindowSize Context window size of the model
     * @param data.toolCallsMetadata Enriched tool call info for UI recovery
     */
    recordAssistantTurn(data: {
        model: string;
        message?: PartListUnion;
        tokens?: GenerateContentResponseUsageMetadata;
        contextWindowSize?: number;
    }): void;
    /**
     * Fire-and-forget: after an assistant turn is recorded, attempt to generate
     * a short session title from the conversation so far. Runs at most once per
     * process lifetime per session and only when:
     *
     * - No title is already set (auto must never overwrite a manual rename,
     *   and we don't need to regenerate an existing auto title mid-session).
     * - A fast model is configured — the service itself also guards this,
     *   but checking here avoids paying for the import/history load when
     *   there's no point.
     *
     * Errors are swallowed. The title is best-effort and must never surface
     * as a user-visible error or interrupt recording.
     */
    private maybeTriggerAutoTitle;
    /**
     * Records tool results (function responses) sent back to the model.
     * Writes immediately to disk.
     *
     * @param message The raw PartListUnion object with functionResponse parts
     * @param toolCallResult Optional tool call result info for UI recovery
     */
    recordToolResult(message: PartListUnion, toolCallResult?: Partial<ToolCallResponseInfo> & {
        status: Status;
    }): void;
    /**
     * Records a slash command invocation as a system record. This keeps the model
     * history clean while allowing resume to replay UI output for commands like
     * /about.
     */
    recordSlashCommand(payload: SlashCommandRecordPayload): void;
    /**
     * Records a chat compression checkpoint as a system record. This keeps the UI
     * history immutable while allowing resume/continue flows to reconstruct the
     * compressed model-facing history from the stored snapshot.
     */
    recordChatCompression(payload: ChatCompressionRecordPayload): void;
    /**
     * Records a UI telemetry event for replaying metrics on resume.
     */
    recordUiTelemetryEvent(uiEvent: UiEvent): void;
    /**
     * Records a conversation rewind and re-roots the parentUuid chain.
     *
     * Sets `lastRecordUuid` back to the UUID that was current just before the
     * target user turn was recorded, then appends a rewind system record.
     * This makes all messages after that point sit on a dead branch in the
     * UUID tree, so `reconstructHistory()` will skip them on resume.
     *
     * @param targetTurnIndex 0-based index of the user turn to rewind to.
     *   For example, 0 means rewind to the very first user message (keeping
     *   nothing before it), 1 means keep the first user turn, etc.
     * @param payload Additional metadata to persist with the rewind record.
     */
    rewindRecording(targetTurnIndex: number, payload: RewindRecordPayload): void;
    /**
     * Rebuilds `turnParentUuids` from a reconstructed message list.
     *
     * Call this after resuming a session so that subsequent rewinds within
     * the resumed session have correct boundary data. Also updates
     * `lastRecordUuid` to the last record in the chain.
     */
    rebuildTurnBoundaries(messages: ChatRecord[]): void;
    /**
     * Records a custom title for the session.
     * Appended as a system record so it persists with the session data.
     * Also caches the title in memory for re-append on shutdown.
     *
     * @param customTitle The title text.
     * @param titleSource Where the title came from — defaults to `'manual'`
     *   so existing `/rename` call sites keep their behavior unchanged.
     * @returns true if the record was written successfully, false on I/O error.
     */
    recordCustomTitle(customTitle: string, titleSource?: TitleSource): boolean;
    /**
     * Finalizes the current session by re-appending cached metadata to EOF.
     *
     * Call this whenever leaving the current session — whether switching to
     * another session, shutting down the process, or any other transition.
     * This single entry point replaces scattered re-append calls and ensures
     * the custom_title record stays within the last 64KB tail window that
     * readSessionTitleFromFile() scans.
     *
     * Best-effort: errors are logged but never thrown.
     */
    finalize(): void;
    /**
     * Records @-command metadata as a system record for UI reconstruction.
     */
    recordAtCommand(payload: AtCommandRecordPayload): void;
}
