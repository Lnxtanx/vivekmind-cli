/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from 'react';
import type { TextBuffer } from './shared/text-buffer.js';
import type { Config } from '@vivekmind/core';
import type { Key } from '../hooks/useKeypress.js';
import type { CommandContext, SlashCommand } from '../commands/types.js';
import { ApprovalMode } from '@vivekmind/core';
/**
 * Represents an attachment (e.g., pasted image) displayed above the input prompt
 */
export interface Attachment {
    id: string;
    path: string;
    filename: string;
}
export interface InputPromptProps {
    buffer: TextBuffer;
    onSubmit: (value: string, attachments?: Attachment[]) => void;
    userMessages: readonly string[];
    onClearScreen: () => void;
    config: Config;
    slashCommands: readonly SlashCommand[];
    commandContext: CommandContext;
    placeholder?: string;
    focus?: boolean;
    inputWidth: number;
    suggestionsWidth: number;
    shellModeActive: boolean;
    setShellModeActive: (value: boolean) => void;
    approvalMode: ApprovalMode;
    onEscapePromptChange?: (showPrompt: boolean) => void;
    onToggleShortcuts?: () => void;
    showShortcuts?: boolean;
    onSuggestionsVisibilityChange?: (visible: boolean) => void;
    vimHandleInput?: (key: Key) => boolean;
    isEmbeddedShellFocused?: boolean;
    /** Prompt suggestion text to display after response completes */
    promptSuggestion?: string | null;
    /** Called when prompt suggestion is dismissed (user typed) */
    onPromptSuggestionDismiss?: () => void;
}
export { calculatePromptWidths } from '../utils/layoutUtils.js';
export declare const InputPrompt: React.FC<InputPromptProps>;
