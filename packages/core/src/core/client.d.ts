/**
 * @license
 * Copyright 2026 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Content, GenerateContentConfig, GenerateContentResponse, PartListUnion } from '@google/genai';
import { type Config } from '../config/config.js';
import { GeminiChat } from './geminiChat.js';
import { Turn, type ChatCompressionInfo, type ServerGeminiStreamEvent } from './turn.js';
import { LoopDetectionService } from '../services/loopDetectionService.js';
export declare enum SendMessageType {
    UserQuery = "userQuery",
    ToolResult = "toolResult",
    Retry = "retry",
    Hook = "hook",
    /** Cron-fired prompt. Behaves like UserQuery but skips UserPromptSubmit hook. */
    Cron = "cron",
    /** Background agent notification. Display item is added by the drain loop. */
    Notification = "notification"
}
export interface SendMessageOptions {
    type: SendMessageType;
    /** Track stop hook iterations to prevent infinite loops and display loop info */
    stopHookState?: {
        iterationCount: number;
        reasons: string[];
    };
    /** Display text for notification messages (persisted for session resume). */
    notificationDisplayText?: string;
    /** Model override from skill execution. When present, overrides the session model for this turn. */
    modelOverride?: string;
}
export declare class GeminiClient {
    private readonly config;
    private chat?;
    private sessionTurnCount;
    private readonly surfacedRelevantAutoMemoryPaths;
    private readonly loopDetector;
    private lastPromptId;
    private lastSentIdeContext;
    private forceFullIdeContext;
    /**
     * At any point in this conversation, was compression triggered without
     * being forced and did it fail?
     */
    private hasFailedCompressionAttempt;
    /**
     * Promises for pending background memory tasks (dream / extract).
     * Each promise resolves with a count of memory files touched (0 = nothing written).
     * Consumed by the CLI via `consumePendingMemoryTaskPromises()`.
     */
    private pendingMemoryTaskPromises;
    /**
     * Timestamp (epoch ms) of the last completed API call.
     * Used to detect idle periods for thinking block cleanup.
     * Starts as null — on the first query there is no prior thinking to clean,
     * so the idle check is skipped until the first API call completes.
     */
    private lastApiCompletionTimestamp;
    constructor(config: Config);
    initialize(): Promise<void>;
    private getContentGeneratorOrFail;
    addHistory(content: Content): Promise<void>;
    getChat(): GeminiChat;
    isInitialized(): boolean;
    getHistory(curated?: boolean): Content[];
    private stripOrphanedUserEntriesFromHistory;
    setHistory(history: Content[]): void;
    truncateHistory(keepCount: number): void;
    setTools(): Promise<void>;
    resetChat(): Promise<void>;
    getLoopDetectionService(): LoopDetectionService;
    addDirectoryContext(): Promise<void>;
    private getMainSessionSystemInstruction;
    startChat(extraHistory?: Content[]): Promise<GeminiChat>;
    private getIdeContextParts;
    private runManagedAutoMemoryBackgroundTasks;
    /**
     * Returns and clears the list of pending background memory task promises.
     * Each promise resolves with the number of memory files touched (0 = nothing
     * was written, caller should ignore).
     */
    consumePendingMemoryTaskPromises(): Array<Promise<number>>;
    sendMessageStream(request: PartListUnion, signal: AbortSignal, prompt_id: string, options?: SendMessageOptions, turns?: number): AsyncGenerator<ServerGeminiStreamEvent, Turn>;
    generateContent(contents: Content[], generationConfig: GenerateContentConfig, abortSignal: AbortSignal, model: string, promptIdOverride?: string): Promise<GenerateContentResponse>;
    tryCompressChat(prompt_id: string, force?: boolean, signal?: AbortSignal): Promise<ChatCompressionInfo>;
}
export declare const TEST_ONLY: {
    COMPRESSION_PRESERVE_THRESHOLD: number;
    COMPRESSION_TOKEN_THRESHOLD: number;
};
