/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ToolCallRequestInfo, ToolCallResponseInfo, ToolCallConfirmationDetails, ToolResultDisplay, EditorType, Config, ToolConfirmationPayload, AnyDeclarativeTool, AnyToolInvocation, ChatRecordingService } from '../index.js';
import { ToolConfirmationOutcome } from '../index.js';
import type { Part, PartListUnion } from '@google/genai';
export type ValidatingToolCall = {
    status: 'validating';
    request: ToolCallRequestInfo;
    tool: AnyDeclarativeTool;
    invocation: AnyToolInvocation;
    startTime?: number;
    outcome?: ToolConfirmationOutcome;
};
export type ScheduledToolCall = {
    status: 'scheduled';
    request: ToolCallRequestInfo;
    tool: AnyDeclarativeTool;
    invocation: AnyToolInvocation;
    startTime?: number;
    outcome?: ToolConfirmationOutcome;
};
export type ErroredToolCall = {
    status: 'error';
    request: ToolCallRequestInfo;
    response: ToolCallResponseInfo;
    tool?: AnyDeclarativeTool;
    durationMs?: number;
    outcome?: ToolConfirmationOutcome;
};
export type SuccessfulToolCall = {
    status: 'success';
    request: ToolCallRequestInfo;
    tool: AnyDeclarativeTool;
    response: ToolCallResponseInfo;
    invocation: AnyToolInvocation;
    durationMs?: number;
    outcome?: ToolConfirmationOutcome;
};
export type ExecutingToolCall = {
    status: 'executing';
    request: ToolCallRequestInfo;
    tool: AnyDeclarativeTool;
    invocation: AnyToolInvocation;
    liveOutput?: ToolResultDisplay;
    /** Timestamp when the tool was first scheduled (validating). */
    startTime?: number;
    /**
     * Timestamp when the tool actually began executing (after any
     * approval/scheduling wait). Use this for "how long has this been
     * running" displays; prefer it over startTime to exclude approval time.
     */
    executionStartTime?: number;
    outcome?: ToolConfirmationOutcome;
    pid?: number;
};
export type CancelledToolCall = {
    status: 'cancelled';
    request: ToolCallRequestInfo;
    response: ToolCallResponseInfo;
    tool: AnyDeclarativeTool;
    invocation: AnyToolInvocation;
    durationMs?: number;
    outcome?: ToolConfirmationOutcome;
};
export type WaitingToolCall = {
    status: 'awaiting_approval';
    request: ToolCallRequestInfo;
    tool: AnyDeclarativeTool;
    invocation: AnyToolInvocation;
    confirmationDetails: ToolCallConfirmationDetails;
    startTime?: number;
    outcome?: ToolConfirmationOutcome;
};
export type Status = ToolCall['status'];
export type ToolCall = ValidatingToolCall | ScheduledToolCall | ErroredToolCall | SuccessfulToolCall | ExecutingToolCall | CancelledToolCall | WaitingToolCall;
export type CompletedToolCall = SuccessfulToolCall | CancelledToolCall | ErroredToolCall;
/**
 * Pull the filesystem path-bearing fields out of a tool's input.
 * Per-tool dispatcher because the field name and shape differ:
 *
 *  - read_file / edit / write_file → `file_path`
 *  - list_directory → `path` (search root)
 *  - glob → `path` (search root, optional) + `pattern` (path-shaped
 *    selector); `<path>/<pattern>` is the effective glob walked
 *  - grep_search → `path` (search root, optional) + `glob` (path-shaped
 *    file filter); `pattern` is a regex on contents, NOT a path
 *  - lsp → `filePath` (URI-aware: `file://` accepted, others dropped)
 *    plus `callHierarchyItem.uri` for incomingCalls / outgoingCalls
 *
 * Used by ConditionalRulesRegistry / SkillActivationRegistry hooks to
 * route every project-relative path the tool actually touched through
 * the same activation pipeline. Returns `[]` for tool names outside
 * `FS_PATH_TOOL_NAMES` — see that set's docstring for why this is gated.
 */
export declare function extractToolFilePaths(toolName: string, toolInput: unknown): string[];
export type ConfirmHandler = (toolCall: WaitingToolCall) => Promise<ToolConfirmationOutcome>;
export type OutputUpdateHandler = (toolCallId: string, outputChunk: ToolResultDisplay) => void;
export type AllToolCallsCompleteHandler = (completedToolCalls: CompletedToolCall[]) => Promise<void>;
export type ToolCallsUpdateHandler = (toolCalls: ToolCall[]) => void;
export declare function convertToFunctionResponse(toolName: string, callId: string, llmContent: PartListUnion): Part[];
interface CoreToolSchedulerOptions {
    config: Config;
    outputUpdateHandler?: OutputUpdateHandler;
    onAllToolCallsComplete?: AllToolCallsCompleteHandler;
    onToolCallsUpdate?: ToolCallsUpdateHandler;
    getPreferredEditor: () => EditorType | undefined;
    onEditorClose: () => void;
    /**
     * Optional recording service. If provided, tool results will be recorded.
     */
    chatRecordingService?: ChatRecordingService;
}
export declare class CoreToolScheduler {
    private toolRegistry;
    private toolCalls;
    private outputUpdateHandler?;
    private onAllToolCallsComplete?;
    private onToolCallsUpdate?;
    private getPreferredEditor;
    private config;
    private onEditorClose;
    private chatRecordingService?;
    private isFinalizingToolCalls;
    private isScheduling;
    private validationRetryCounts;
    private requestQueue;
    constructor(options: CoreToolSchedulerOptions);
    private setStatusInternal;
    private setArgsInternal;
    private isRunning;
    private buildInvocation;
    /**
     * Generates error message for unknown tool. Returns early with skill-specific
     * message if the name matches a skill, otherwise uses Levenshtein suggestions.
     */
    private getToolNotFoundMessage;
    /** Suggests similar tool names using Levenshtein distance. */
    private getToolSuggestion;
    schedule(request: ToolCallRequestInfo | ToolCallRequestInfo[], signal: AbortSignal): Promise<void>;
    /**
     * Removes all validation retry counters for the given tool. Keys are
     * "<toolName>:<errorMessage>", so a plain `Map.delete(toolName)` would not
     * match anything.
     */
    private clearRetryCountsForTool;
    private _schedule;
    handleConfirmationResponse(callId: string, originalOnConfirm: (outcome: ToolConfirmationOutcome, payload?: ToolConfirmationPayload) => Promise<void>, outcome: ToolConfirmationOutcome, signal: AbortSignal, payload?: ToolConfirmationPayload): Promise<void>;
    /**
     * Opens an IDE diff view for edit-type tools when IDE mode is active.
     * The IDE resolution is handled asynchronously — if the user accepts or
     * rejects from the IDE, it triggers handleConfirmationResponse.
     *
     * Uses confirmationDetails.filePath / newContent (the same data shown in
     * CLI diff) rather than ModifyContext so that the IDE diff is always
     * consistent with the CLI and with resolveDiffFromCli.
     */
    private openIdeDiffIfEnabled;
    /**
     * Applies user-provided content changes to a tool call that is awaiting confirmation.
     * This method updates the tool's arguments and refreshes the confirmation prompt with a new diff
     * before the tool is scheduled for execution.
     * @private
     */
    private _applyInlineModify;
    private attemptExecutionOfScheduledCalls;
    /**
     * Execute multiple tool calls concurrently with a concurrency cap.
     */
    private runConcurrently;
    private executeSingleToolCall;
    private checkAndNotifyCompletion;
    /**
     * Records tool results to the chat recording service.
     * This captures both the raw Content (for API reconstruction) and
     * enriched metadata (for UI recovery).
     */
    private recordToolResults;
    private notifyToolCallsUpdate;
    private setToolCallOutcome;
    private autoApproveCompatiblePendingTools;
}
export {};
