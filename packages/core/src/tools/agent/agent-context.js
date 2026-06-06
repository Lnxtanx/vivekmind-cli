/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * @fileoverview Ambient agent-identity context for nested `agent` tool calls.
 *
 * When a subagent's model calls the `agent` tool, the resulting
 * AgentToolInvocation's `this.config` is the main process Config (see
 * comment in `fork-subagent.ts`) — it has no way to know which subagent
 * made the call. We carry the launching agent's id via AsyncLocalStorage
 * so nested launches can record `parentAgentId` in their sidecar meta.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
const agentContextStorage = new AsyncLocalStorage();
/**
 * Runs `fn` with an ambient agent-identity frame.
 *
 * Wrap the subagent's execution (headless run loop and any hook-driven
 * continuations) so every nested `agent` tool invocation inside it reads
 * the launching agent's id via {@link getCurrentAgentId}.
 */
export function runWithAgentContext(context, fn) {
    return agentContextStorage.run(context, fn);
}
/**
 * Returns the id of the subagent whose execution is currently on the call
 * stack, or `null` at the top-level user session.
 */
export function getCurrentAgentId() {
    return agentContextStorage.getStore()?.agentId ?? null;
}
//# sourceMappingURL=agent-context.js.map