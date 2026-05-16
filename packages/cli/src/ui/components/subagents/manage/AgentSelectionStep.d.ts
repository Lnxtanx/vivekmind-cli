/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type SubagentConfig } from '@vivekmind/core';
interface AgentSelectionStepProps {
    availableAgents: SubagentConfig[];
    onAgentSelect: (agentIndex: number) => void;
}
export declare const AgentSelectionStep: ({ availableAgents, onAgentSelect, }: AgentSelectionStepProps) => import("react/jsx-runtime").JSX.Element;
export {};
