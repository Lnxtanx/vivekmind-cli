/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type SubagentConfig } from '@vivekmind/core';
import type { StepNavigationProps } from '../types.js';
interface AgentDeleteStepProps extends StepNavigationProps {
    selectedAgent: SubagentConfig | null;
    onDelete: (agent: SubagentConfig) => Promise<void>;
}
export declare function AgentDeleteStep({ selectedAgent, onDelete, onNavigateBack, }: AgentDeleteStepProps): import("react/jsx-runtime").JSX.Element;
export {};
