/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../config/config.js';
import type { ToolInvocation, ToolResult, ToolResultDisplay, ToolCallConfirmationDetails } from './tools.js';
import type { PermissionDecision } from '../permissions/types.js';
import { BaseDeclarativeTool, BaseToolInvocation } from './tools.js';
import type { ShellExecutionConfig } from '../services/shellExecutionService.js';
export declare const OUTPUT_UPDATE_INTERVAL_MS = 1000;
/**
 * Format the long-run advisory appended to long foreground commands.
 * Exported so tests and any future consumer (e.g. an alternative
 * renderer) can render the same text without duplicating the threshold
 * logic.
 *
 * Wording deliberately keeps the dialog mention conditional ("when
 * running interactively") so the LLM doesn't relay misleading guidance
 * to non-TTY users (`-p` headless / ACP / SDK consumers, where no
 * dialog or footer pill exists). `/tasks` and the on-disk output file
 * work in every mode.
 */
export declare function buildLongRunningForegroundHint(elapsedMs: number): string;
/**
 * Detect standalone or leading `sleep N` patterns that should use Monitor
 * instead. Catches `sleep 5`, `sleep 2.5`, `sleep 2s`,
 * `sleep 5 && check`, `sleep 5; check`, `sleep 5 # wait` — but not sleep
 * inside pipelines, subshells, backgrounded commands, or scripts (those are
 * fine).
 */
export declare function detectBlockedSleepPattern(command: string): string | null;
export interface ShellToolParams {
    command: string;
    is_background: boolean;
    timeout?: number;
    description?: string;
    directory?: string;
}
export declare class ShellToolInvocation extends BaseToolInvocation<ShellToolParams, ToolResult> {
    private readonly config;
    constructor(config: Config, params: ShellToolParams);
    getDescription(): string;
    /**
     * AST-based permission check for the shell command.
     * - Read-only commands (via AST analysis) → 'allow'
     * - All other commands → 'ask'
     */
    getDefaultPermission(): Promise<PermissionDecision>;
    /**
     * Constructs confirmation dialog details for a shell command that needs
     * user approval.  For compound commands (e.g. `cd foo && npm run build`),
     * sub-commands that are already allowed (read-only) are excluded from both
     * the displayed root-command list and the suggested permission rules.
     */
    getConfirmationDetails(_abortSignal: AbortSignal): Promise<ToolCallConfirmationDetails>;
    execute(signal: AbortSignal, updateOutput?: (output: ToolResultDisplay) => void, shellExecutionConfig?: ShellExecutionConfig, setPidCallback?: (pid: number) => void): Promise<ToolResult>;
    /**
     * Background-execution path: spawn the command into a managed registry
     * entry instead of detaching with `&`. Output streams to a per-shell file
     * the agent can `Read`; cancellation flows through the entry's
     * AbortController; the registry's terminal status is set when the process
     * exits. Returns immediately so the agent's turn isn't blocked.
     */
    private executeBackground;
    private addCoAuthorToGitCommit;
}
export declare class ShellTool extends BaseDeclarativeTool<ShellToolParams, ToolResult> {
    private readonly config;
    static Name: string;
    constructor(config: Config);
    protected validateToolParamValues(params: ShellToolParams): string | null;
    protected createInvocation(params: ShellToolParams): ToolInvocation<ShellToolParams, ToolResult>;
}
