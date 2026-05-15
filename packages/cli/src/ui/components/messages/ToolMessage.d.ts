/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import type { IndividualToolCallDisplay } from '../../types.js';
import type { Config } from '@vivekmind/core';
export type TextEmphasis = 'high' | 'medium' | 'low';
export interface ToolMessageProps extends IndividualToolCallDisplay {
    availableTerminalHeight?: number;
    contentWidth: number;
    emphasis?: TextEmphasis;
    renderOutputAsMarkdown?: boolean;
    activeShellPtyId?: number | null;
    embeddedShellFocused?: boolean;
    config?: Config;
    forceShowResult?: boolean;
    /**
     * Whether this subagent owns keyboard input for confirmations and
     * Ctrl+E/Ctrl+F display shortcuts.
     */
    isFocused?: boolean;
    /** Whether another subagent's approval currently holds the focus lock, blocking this one. */
    isWaitingForOtherApproval?: boolean;
}
export declare const ToolMessage: React.FC<ToolMessageProps>;
