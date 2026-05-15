/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
interface AgentContext {
    readonly agentId: string;
}
/**
 * Runs `fn` with an ambient agent-identity frame.
 *
 * Wrap the subagent's execution (headless run loop and any hook-driven
 * continuations) so every nested `agent` tool invocation inside it reads
 * the launching agent's id via {@link getCurrentAgentId}.
 */
export declare function runWithAgentContext<T>(context: AgentContext, fn: () => Promise<T>): Promise<T>;
/**
 * Returns the id of the subagent whose execution is currently on the call
 * stack, or `null` at the top-level user session.
 */
export declare function getCurrentAgentId(): string | null;
export {};
