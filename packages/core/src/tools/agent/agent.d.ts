/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { BaseDeclarativeTool, BaseToolInvocation } from '../tools.js';
import type { ToolResult, ToolResultDisplay } from '../tools.js';
import type { Config } from '../../config/config.js';
import type { SubagentManager } from '../../subagents/subagent-manager.js';
import { AgentEventEmitter } from '../../agents/runtime/agent-events.js';
import { PermissionMode } from '../../hooks/types.js';
import { ApprovalMode } from '../../config/config.js';
export interface AgentParams {
    description: string;
    prompt: string;
    subagent_type?: string;
    run_in_background?: boolean;
}
/**
 * Resolves the effective permission mode for a sub-agent.
 *
 * Rules (matching claw-code):
 * - Permissive parent modes (yolo, auto-edit) always win
 * - Otherwise, the agent definition's mode applies if set
 * - Default fallback is auto-edit (sub-agents need autonomy)
 */
export declare function resolveSubagentApprovalMode(parentApprovalMode: ApprovalMode, agentApprovalMode?: string, isTrustedFolder?: boolean): PermissionMode;
/**
 * Agent tool that enables primary agents to delegate tasks to specialized agents.
 * The tool dynamically loads available agents and includes them in its description
 * for the model to choose from.
 */
export declare class AgentTool extends BaseDeclarativeTool<AgentParams, ToolResult> {
    private readonly config;
    static readonly Name: string;
    private subagentManager;
    private availableSubagents;
    private readonly removeChangeListener;
    constructor(config: Config);
    dispose(): void;
    /**
     * Asynchronously initializes the tool by loading available subagents
     * and updating the description and schema.
     */
    refreshSubagents(): Promise<void>;
    /**
     * Updates the tool's description and schema based on available subagents.
     */
    private updateDescriptionAndSchema;
    validateToolParams(params: AgentParams): string | null;
    protected createInvocation(params: AgentParams): AgentToolInvocation;
    getAvailableSubagentNames(): string[];
}
declare class AgentToolInvocation extends BaseToolInvocation<AgentParams, ToolResult> {
    private readonly config;
    private readonly subagentManager;
    readonly eventEmitter: AgentEventEmitter;
    private currentDisplay;
    private currentToolCalls;
    private callId?;
    constructor(config: Config, subagentManager: SubagentManager, params: AgentParams);
    setCallId(callId: string): void;
    /**
     * Updates the current display state and calls updateOutput if provided
     */
    private updateDisplay;
    /**
     * Sets up event listeners for real-time subagent progress updates
     */
    private setupEventListeners;
    getDescription(): string;
    /**
     * Creates a fork subagent that inherits the parent's conversation context
     * and cache-safe generation params.
     */
    private createForkSubagent;
    private runSubagentStopHookLoop;
    /**
     * Runs a subagent with start/stop hook lifecycle, updating the display
     * as execution progresses.
     */
    private runSubagentWithHooks;
    execute(signal?: AbortSignal, updateOutput?: (output: ToolResultDisplay) => void): Promise<ToolResult>;
}
export {};
