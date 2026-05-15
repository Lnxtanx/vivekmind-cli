/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import type { AgentResultDisplay, Config } from '@vivekmind/core';
export type DisplayMode = 'compact' | 'default' | 'verbose';
export interface AgentExecutionDisplayProps {
    data: AgentResultDisplay;
    availableHeight?: number;
    childWidth: number;
    config: Config;
    /**
     * Whether this subagent owns keyboard input for confirmations and
     * Ctrl+E/Ctrl+F display shortcuts.
     */
    isFocused?: boolean;
    /** Whether another subagent's approval currently holds the focus lock, blocking this one. */
    isWaitingForOtherApproval?: boolean;
}
/**
 * Component to display subagent execution progress and results.
 * This is now a pure component that renders the provided SubagentExecutionResultDisplay data.
 * Real-time updates are handled by the parent component updating the data prop.
 */
export declare const AgentExecutionDisplay: React.FC<AgentExecutionDisplayProps>;
