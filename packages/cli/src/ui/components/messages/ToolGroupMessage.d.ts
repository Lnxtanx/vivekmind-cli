/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from 'react';
import type { IndividualToolCallDisplay } from '../../types.js';
interface ToolGroupMessageProps {
    groupId: number;
    toolCalls: IndividualToolCallDisplay[];
    availableTerminalHeight?: number;
    contentWidth: number;
    isFocused?: boolean;
    activeShellPtyId?: number | null;
    embeddedShellFocused?: boolean;
    onShellInputSubmit?: (input: string) => void;
    /** Pre-computed count of write ops to managed-auto-memory files. */
    memoryWriteCount?: number;
    /** Pre-computed count of read ops from managed-auto-memory files. */
    memoryReadCount?: number;
    isUserInitiated?: boolean;
    /**
     * Short LLM-generated label for this batch. Used in compact mode in place
     * of the "active tool name × count" line. Undefined when summary
     * generation is disabled, still in-flight, or failed.
     */
    compactLabel?: string;
}
export declare const ToolGroupMessage: React.FC<ToolGroupMessageProps>;
export {};
