/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../../config/config.js';
import type { ToolCallConfirmationDetails, ToolResultDisplay } from '../../tools/tools.js';
import type { Content, FunctionCall, FunctionDeclaration } from '@google/genai';
import { GeminiChat } from '../../core/geminiChat.js';
import type { PromptConfig, ModelConfig, RunConfig, ToolConfig, AgentMessage } from './agent-types.js';
import { AgentTerminateMode } from './agent-types.js';
import type { AgentHooks } from './agent-events.js';
import { AgentEventEmitter } from './agent-events.js';
import { AgentStatistics, type AgentStatsSummary } from './agent-statistics.js';
import { type ContextState } from './agent-headless.js';
/**
 * Result of a single reasoning loop invocation.
 */
/**
 * Tools that must never be available to subagents (including forked agents).
 * - AgentTool prevents recursive subagent spawning.
 * - Cron tools are session-scoped and should only run from the main session.
 * - TaskStop and SendMessage are parent-side control-plane tools for managing
 *   background subagents; subagents have no agent IDs to manage natively, so
 *   exposing them only widens the surface for cross-agent interference if an
 *   ID leaks via prompt or transcript.
 */
export declare const EXCLUDED_TOOLS_FOR_SUBAGENTS: ReadonlySet<string>;
/**
 * Prefix applied to each external message injected into a background agent's
 * reasoning loop via getExternalMessages. Kept here so tests and any future
 * parsers can import the same literal.
 */
export declare const EXTERNAL_MESSAGE_PREFIX = "[Message from parent agent]:";
export interface ReasoningLoopResult {
    /** The final model text response (empty if terminated by abort/limits). */
    text: string;
    /** Why the loop ended. null = normal text completion (no tool calls). */
    terminateMode: AgentTerminateMode | null;
    /** Number of model round-trips completed. */
    turnsUsed: number;
}
/**
 * Options for configuring a reasoning loop invocation.
 */
export interface ReasoningLoopOptions {
    /** Maximum number of turns before stopping. */
    maxTurns?: number;
    /** Maximum wall-clock time in minutes before stopping. */
    maxTimeMinutes?: number;
    /** Start time in ms (for timeout calculation). Defaults to Date.now(). */
    startTimeMs?: number;
    /**
     * Optional callback to drain external messages between tool rounds.
     * Called after processFunctionCalls completes. Returned strings are
     * appended to the next model request as user-role content.
     */
    getExternalMessages?: () => string[];
}
/**
 * Options for chat creation.
 */
export interface CreateChatOptions {
    /**
     * When true, omits the "non-interactive mode" system prompt suffix.
     * Used by AgentInteractive for persistent interactive agents.
     */
    interactive?: boolean;
    /**
     * Optional conversation history from a parent session. When provided,
     * this history is prepended to the chat so the agent has prior
     * conversational context (e.g., from AgentInteractive.start()).
     */
    extraHistory?: Content[];
}
/**
 * Legacy execution stats maintained for backward compatibility.
 */
export interface ExecutionStats {
    startTimeMs: number;
    totalDurationMs: number;
    rounds: number;
    totalToolCalls: number;
    successfulToolCalls: number;
    failedToolCalls: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}
/**
 * AgentCore — shared execution engine for model reasoning and tool scheduling.
 *
 * This class encapsulates:
 * - Chat/model session creation (`createChat`)
 * - Tool list preparation (`prepareTools`)
 * - The inner reasoning loop (`runReasoningLoop`)
 * - Tool call scheduling and execution (`processFunctionCalls`)
 * - Statistics tracking and event emission
 *
 * It does NOT manage lifecycle (start/stop/terminate), abort signals,
 * or final result interpretation — those are the caller's responsibility.
 */
export declare class AgentCore {
    readonly subagentId: string;
    readonly name: string;
    readonly runtimeContext: Config;
    readonly promptConfig: PromptConfig;
    readonly modelConfig: ModelConfig;
    readonly runConfig: RunConfig;
    readonly toolConfig?: ToolConfig;
    /**
     * Event emitter for this agent. Always present — if the caller doesn't
     * pass one, AgentCore allocates its own so the observable state below
     * is populated regardless of who constructs the agent.
     */
    readonly eventEmitter: AgentEventEmitter;
    readonly hooks?: AgentHooks;
    readonly stats: AgentStatistics;
    private readonly messages;
    private readonly pendingApprovals;
    private readonly liveOutputs;
    private readonly shellPids;
    /**
     * Legacy execution stats maintained for aggregate tracking.
     */
    executionStats: ExecutionStats;
    /**
     * The prompt token count from the most recent model response.
     * Exposed so UI hooks can seed initial state without waiting for events.
     */
    lastPromptTokenCount: number;
    private toolUsage;
    constructor(name: string, runtimeContext: Config, promptConfig: PromptConfig, modelConfig: ModelConfig, runConfig: RunConfig, toolConfig?: ToolConfig, eventEmitter?: AgentEventEmitter, hooks?: AgentHooks);
    /**
     * Creates a GeminiChat instance configured for this agent.
     *
     * @param context - Context state for template variable substitution.
     * @param options - Chat creation options.
     *   - `interactive`: When true, omits the "non-interactive mode" system prompt suffix.
     * @returns A configured GeminiChat, or undefined if initialization fails.
     */
    createChat(context: ContextState, options?: CreateChatOptions): Promise<GeminiChat | undefined>;
    /**
     * Prepares the list of tools available to this agent.
     *
     * If no explicit toolConfig or it contains "*" or is empty,
     * inherits all tools (excluding AgentTool to prevent recursion).
     */
    prepareTools(): Promise<FunctionDeclaration[]>;
    /**
     * Runs the inner model reasoning loop.
     *
     * This is the core execution cycle:
     * send messages → stream response → collect tool calls → execute tools → repeat.
     *
     * The loop terminates when:
     * - The model produces a text response without tool calls (normal completion)
     * - maxTurns is reached
     * - maxTimeMinutes is exceeded
     * - The abortController signal fires
     *
     * @param chat - The GeminiChat session to use.
     * @param initialMessages - The first messages to send (e.g., user task prompt).
     * @param toolsList - Available tool declarations.
     * @param abortController - Controls cancellation of the current loop.
     * @param options - Optional limits (maxTurns, maxTimeMinutes).
     * @returns ReasoningLoopResult with the final text, terminate mode, and turns used.
     */
    runReasoningLoop(chat: GeminiChat, initialMessages: Content[], toolsList: FunctionDeclaration[], abortController: AbortController, options?: ReasoningLoopOptions): Promise<ReasoningLoopResult>;
    private _runReasoningLoopInner;
    /**
     * Processes a list of function calls via CoreToolScheduler.
     *
     * Validates each call against the allowed tools list, schedules authorized
     * calls, collects results, and emits events for each call/result.
     *
     * Validates each call, schedules authorized calls, collects results, and emits events.
     */
    processFunctionCalls(functionCalls: FunctionCall[], abortController: AbortController, promptId: string, currentRound: number, toolsList: FunctionDeclaration[], responseId?: string, wasOutputTruncated?: boolean): Promise<Content[]>;
    getMessages(): readonly AgentMessage[];
    /**
     * Tool calls currently awaiting user approval. Mutated by
     * AgentInteractive's TOOL_WAITING_APPROVAL handler; headless agents
     * never populate this because they run with
     * `getShouldAvoidPermissionPrompts === true`.
     */
    getPendingApprovals(): ReadonlyMap<string, ToolCallConfirmationDetails>;
    getLiveOutputs(): ReadonlyMap<string, ToolResultDisplay>;
    getShellPids(): ReadonlyMap<string, number>;
    pushMessage(role: AgentMessage['role'], content: string, options?: {
        thought?: boolean;
        metadata?: Record<string, unknown>;
    }): void;
    setPendingApproval(callId: string, details: ToolCallConfirmationDetails): void;
    deletePendingApproval(callId: string): void;
    clearPendingApprovals(): void;
    getEventEmitter(): AgentEventEmitter;
    getExecutionSummary(): AgentStatsSummary;
    /**
     * Returns legacy execution statistics and per-tool usage.
     * Returns legacy execution statistics and per-tool usage.
     */
    getStatistics(): {
        successRate: number;
        toolUsage: Array<{
            name: string;
            count: number;
            success: number;
            failure: number;
            lastError?: string;
            totalDurationMs?: number;
            averageDurationMs?: number;
        }>;
    } & ExecutionStats;
    /**
     * Safely retrieves the description of a tool by attempting to build it.
     * Returns an empty string if any error occurs during the process.
     * Note: Assumes tools are warmed via warmAll() before the reasoning loop.
     */
    getToolDescription(toolName: string, args: Record<string, unknown>): string;
    private getToolIsOutputMarkdown;
    /**
     * Records tool call statistics for both successful and failed tool calls.
     */
    recordToolCallStats(toolName: string, success: boolean, durationMs: number, errorMessage?: string): void;
    /**
     * TOOL_WAITING_APPROVAL is deliberately NOT listened to here because
     * the correct response depends on whether the consumer is interactive
     * (needs to wrap onConfirm with cancel-round behavior) or headless
     * (approvals never fire). AgentInteractive owns that listener and
     * writes into `pendingApprovals` via the public mutator API.
     */
    private setupStateListeners;
    /**
     * Builds the system prompt with template substitution and optional
     * non-interactive instructions suffix.
     */
    private buildChatSystemPrompt;
    /**
     * Records token usage from model response metadata.
     */
    private recordTokenUsage;
}
