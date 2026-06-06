import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { Box, Text } from 'ink';
import { ToolCallStatus } from '../../types.js';
import { DiffRenderer } from './DiffRenderer.js';
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js';
import { AnsiOutputText, ShellStatsBar } from '../AnsiOutput.js';
import { MaxSizedBox, MINIMUM_MAX_HEIGHT } from '../shared/MaxSizedBox.js';
import { TodoDisplay } from '../TodoDisplay.js';
import { AgentExecutionDisplay } from '../subagents/index.js';
import { PlanSummaryDisplay } from '../PlanSummaryDisplay.js';
import { ShellInputPrompt } from '../ShellInputPrompt.js';
import { SHELL_COMMAND_NAME, SHELL_NAME } from '../../constants.js';
import { theme } from '../../semantic-colors.js';
import { useSettings } from '../../contexts/SettingsContext.js';
import { useCompactMode } from '../../contexts/CompactModeContext.js';
import { getCachedStringWidth, toCodePoints } from '../../utils/textUtils.js';
import { ToolStatusIndicator, STATUS_INDICATOR_WIDTH, } from '../shared/ToolStatusIndicator.js';
import { ToolElapsedTime } from '../shared/ToolElapsedTime.js';
const STATIC_HEIGHT = 1;
const RESERVED_LINE_COUNT = 5; // for tool name, status, padding etc.
const MIN_LINES_SHOWN = 2; // show at least this many lines
const DEFAULT_SHELL_OUTPUT_MAX_LINES = 5;
// Large threshold to ensure we don't cause performance issues for very large
// outputs that will get truncated further MaxSizedBox anyway.
const MAXIMUM_RESULT_DISPLAY_CHARACTERS = 1000000;
function sliceTextForMaxHeight(text, maxHeight, maxWidth) {
    if (maxHeight === undefined) {
        return { text, hiddenLinesCount: 0 };
    }
    const targetMaxHeight = Math.max(Math.round(maxHeight), MINIMUM_MAX_HEIGHT);
    const visibleContentHeight = targetMaxHeight - 1;
    const visualWidth = Math.max(1, Math.floor(maxWidth));
    const visibleLines = [];
    let visualLineCount = 0;
    let currentLine = '';
    let currentLineWidth = 0;
    const appendVisibleLine = (line) => {
        visualLineCount += 1;
        visibleLines.push(line);
        if (visibleLines.length > visibleContentHeight) {
            visibleLines.shift();
        }
    };
    const flushCurrentLine = () => {
        appendVisibleLine(currentLine);
        currentLine = '';
        currentLineWidth = 0;
    };
    for (const char of toCodePoints(text)) {
        if (char === '\n') {
            flushCurrentLine();
            continue;
        }
        const charWidth = Math.max(getCachedStringWidth(char), 1);
        if (currentLineWidth > 0 && currentLineWidth + charWidth > visualWidth) {
            flushCurrentLine();
        }
        currentLine += char;
        currentLineWidth += charWidth;
    }
    flushCurrentLine();
    if (visualLineCount <= targetMaxHeight) {
        return { text, hiddenLinesCount: 0 };
    }
    const hiddenLinesCount = visualLineCount - visibleContentHeight;
    return {
        text: visibleLines.join('\n'),
        hiddenLinesCount,
    };
}
/**
 * Custom hook to determine the type of result display and return appropriate rendering info
 */
const useResultDisplayRenderer = (resultDisplay) => React.useMemo(() => {
    if (!resultDisplay) {
        return { type: 'none' };
    }
    // Check for TodoResultDisplay
    if (typeof resultDisplay === 'object' &&
        resultDisplay !== null &&
        'type' in resultDisplay &&
        resultDisplay.type === 'todo_list') {
        return {
            type: 'todo',
            data: resultDisplay,
        };
    }
    if (typeof resultDisplay === 'object' &&
        resultDisplay !== null &&
        'type' in resultDisplay &&
        resultDisplay.type === 'plan_summary') {
        return {
            type: 'plan',
            data: resultDisplay,
        };
    }
    // Check for SubagentExecutionResultDisplay (for non-task tools)
    if (typeof resultDisplay === 'object' &&
        resultDisplay !== null &&
        'type' in resultDisplay &&
        resultDisplay.type === 'task_execution') {
        return {
            type: 'task',
            data: resultDisplay,
        };
    }
    // Check for FileDiff
    if (typeof resultDisplay === 'object' &&
        resultDisplay !== null &&
        'fileDiff' in resultDisplay) {
        return {
            type: 'diff',
            data: resultDisplay,
        };
    }
    // Check for McpToolProgressData
    if (typeof resultDisplay === 'object' &&
        resultDisplay !== null &&
        'type' in resultDisplay &&
        resultDisplay.type === 'mcp_tool_progress') {
        const progress = resultDisplay;
        const msg = progress.message ?? `Progress: ${progress.progress}`;
        const totalStr = progress.total != null ? `/${progress.total}` : '';
        return {
            type: 'string',
            data: `⏳ [${progress.progress}${totalStr}] ${msg}`,
        };
    }
    // Check for AnsiOutput
    if (typeof resultDisplay === 'object' &&
        resultDisplay !== null &&
        'ansiOutput' in resultDisplay) {
        const display = resultDisplay;
        return {
            type: 'ansi',
            data: display.ansiOutput,
            stats: {
                totalLines: display.totalLines,
                totalBytes: display.totalBytes,
            },
        };
    }
    // Default to string
    return {
        type: 'string',
        data: resultDisplay,
    };
}, [resultDisplay]);
/**
 * Component to render todo list results
 */
const TodoResultRenderer = ({ data, }) => _jsx(TodoDisplay, { todos: data.todos });
const PlanResultRenderer = ({ data, availableHeight, childWidth }) => (_jsx(PlanSummaryDisplay, { data: data, availableHeight: availableHeight, childWidth: childWidth }));
/**
 * Component to render subagent execution results
 */
const SubagentExecutionRenderer = ({ data, availableHeight, childWidth, config, isFocused, isWaitingForOtherApproval, }) => (_jsx(AgentExecutionDisplay, { data: data, availableHeight: availableHeight, childWidth: childWidth, config: config, isFocused: isFocused, isWaitingForOtherApproval: isWaitingForOtherApproval }));
/**
 * Component to render string results (markdown or plain text)
 */
const StringResultRenderer = ({ data, renderAsMarkdown, availableHeight, childWidth }) => {
    let displayData = data;
    // Truncate if too long
    if (displayData.length > MAXIMUM_RESULT_DISPLAY_CHARACTERS) {
        displayData = '...' + displayData.slice(-MAXIMUM_RESULT_DISPLAY_CHARACTERS);
    }
    if (renderAsMarkdown) {
        return (_jsx(Box, { flexDirection: "column", children: _jsx(MarkdownDisplay, { text: displayData, isPending: false, availableTerminalHeight: availableHeight, contentWidth: childWidth }) }));
    }
    const sliced = sliceTextForMaxHeight(displayData, availableHeight, childWidth);
    return (_jsx(MaxSizedBox, { maxHeight: availableHeight, maxWidth: childWidth, additionalHiddenLinesCount: sliced.hiddenLinesCount, children: _jsx(Box, { children: _jsx(Text, { wrap: "wrap", color: theme.text.primary, children: sliced.text }) }) }));
};
/**
 * Component to render diff results
 */
const DiffResultRenderer = ({ data, availableHeight, childWidth, settings }) => (_jsx(DiffRenderer, { diffContent: data.fileDiff, filename: data.fileName, availableTerminalHeight: availableHeight, contentWidth: childWidth, settings: settings }));
export const ToolMessage = ({ name, description, resultDisplay, status, availableTerminalHeight, contentWidth, emphasis = 'medium', renderOutputAsMarkdown = true, activeShellPtyId, embeddedShellFocused, ptyId, config, forceShowResult, isFocused, isWaitingForOtherApproval, executionStartTime, }) => {
    const settings = useSettings();
    const isThisShellFocused = (name === SHELL_COMMAND_NAME || name === SHELL_NAME) &&
        status === ToolCallStatus.Executing &&
        ptyId === activeShellPtyId &&
        embeddedShellFocused;
    const [lastUpdateTime, setLastUpdateTime] = React.useState(null);
    const [userHasFocused, setUserHasFocused] = React.useState(false);
    const [showFocusHint, setShowFocusHint] = React.useState(false);
    React.useEffect(() => {
        if (resultDisplay) {
            setLastUpdateTime(new Date());
        }
    }, [resultDisplay]);
    // Shell tools surface their configured timeout via AnsiOutputDisplay as
    // soon as streaming starts. Feed it into ToolElapsedTime so the budget is
    // shown inline (`(elapsed · timeout N)`) instead of in a separate stats
    // row.
    const shellTimeoutMs = React.useMemo(() => {
        if (typeof resultDisplay === 'object' &&
            resultDisplay !== null &&
            'ansiOutput' in resultDisplay) {
            return resultDisplay.timeoutMs;
        }
        return undefined;
    }, [resultDisplay]);
    React.useEffect(() => {
        if (!lastUpdateTime) {
            return;
        }
        const timer = setTimeout(() => {
            setShowFocusHint(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, [lastUpdateTime]);
    React.useEffect(() => {
        if (isThisShellFocused) {
            setUserHasFocused(true);
        }
    }, [isThisShellFocused]);
    const isThisShellFocusable = (name === SHELL_COMMAND_NAME || name === SHELL_NAME) &&
        status === ToolCallStatus.Executing &&
        config?.getShouldUseNodePtyShell();
    const shouldShowFocusHint = isThisShellFocusable && (showFocusHint || userHasFocused);
    const availableHeight = availableTerminalHeight
        ? Math.max(availableTerminalHeight - STATIC_HEIGHT - RESERVED_LINE_COUNT, MIN_LINES_SHOWN + 1)
        : undefined;
    // Cap inline shell output. Applies to both the streaming ANSI display and
    // the completed string display (shell.ts emits the final result as a plain
    // string via `returnDisplayMessage = result.output`). ShellStatsBar surfaces
    // hidden lines via `+N lines` for ANSI; MaxSizedBox handles overflow for string.
    const isShellTool = name === SHELL_COMMAND_NAME || name === SHELL_NAME;
    const rawShellCap = settings.merged.ui?.shellOutputMaxLines ?? DEFAULT_SHELL_OUTPUT_MAX_LINES;
    // Defensive: clamp non-negative integers; treat negatives / NaN / fractions
    // as the user's clear intent (0 = disable, otherwise floor to whole rows).
    const shellOutputMaxLines = Math.max(0, Math.floor(rawShellCap || 0));
    const isCappingShell = isShellTool &&
        shellOutputMaxLines > 0 &&
        !forceShowResult &&
        !isThisShellFocused;
    const shellCapHeight = isCappingShell
        ? Math.min(availableHeight ?? shellOutputMaxLines, shellOutputMaxLines)
        : availableHeight;
    // String path: MaxSizedBox reserves one row for its overflow banner when
    // content overflows (see MaxSizedBox.tsx visibleContentHeight = max - 1),
    // so passing the bare cap shows N-1 content rows. ANSI pre-slices to N
    // (no MaxSizedBox overflow) and renders N rows + the ShellStatsBar line.
    // +1 keeps the two paths visually symmetric at N visible content rows.
    const shellStringCapHeight = isCappingShell && shellCapHeight !== undefined
        ? shellCapHeight + 1
        : availableHeight;
    const innerWidth = contentWidth - STATUS_INDICATOR_WIDTH;
    // Long tool call response in MarkdownDisplay doesn't respect availableTerminalHeight properly,
    // we're forcing it to not render as markdown when the response is too long, it will fallback
    // to render as plain text, which is contained within the terminal using MaxSizedBox
    if (availableHeight) {
        renderOutputAsMarkdown = false;
    }
    // Use the custom hook to determine the display type
    const displayRenderer = useResultDisplayRenderer(resultDisplay);
    const { compactMode } = useCompactMode();
    const effectiveDisplayRenderer = !compactMode || forceShowResult
        ? displayRenderer
        : { type: 'none' };
    return (_jsxs(Box, { paddingX: 1, paddingY: 0, flexDirection: "column", children: [_jsxs(Box, { minHeight: 1, children: [_jsx(ToolStatusIndicator, { status: status, name: name }), _jsx(ToolInfo, { name: name, status: status, description: description, emphasis: emphasis }), shouldShowFocusHint && (_jsx(Box, { marginLeft: 1, flexShrink: 0, children: _jsx(Text, { color: theme.text.accent, children: isThisShellFocused ? '(Focused)' : '(ctrl+f to focus)' }) })), _jsx(ToolElapsedTime, { status: status, executionStartTime: executionStartTime, timeoutMs: shellTimeoutMs }), emphasis === 'high' && _jsx(TrailingIndicator, {})] }), effectiveDisplayRenderer.type !== 'none' && (_jsx(Box, { paddingLeft: STATUS_INDICATOR_WIDTH, width: "100%", marginTop: 1, children: _jsxs(Box, { flexDirection: "column", children: [effectiveDisplayRenderer.type === 'todo' && (_jsx(TodoResultRenderer, { data: effectiveDisplayRenderer.data })), effectiveDisplayRenderer.type === 'plan' && (_jsx(PlanResultRenderer, { data: effectiveDisplayRenderer.data, availableHeight: availableHeight, childWidth: innerWidth })), effectiveDisplayRenderer.type === 'task' && config && (_jsx(SubagentExecutionRenderer, { data: effectiveDisplayRenderer.data, availableHeight: availableHeight, childWidth: innerWidth, config: config, isFocused: isFocused, isWaitingForOtherApproval: isWaitingForOtherApproval })), effectiveDisplayRenderer.type === 'diff' && (_jsx(DiffResultRenderer, { data: effectiveDisplayRenderer.data, availableHeight: availableHeight, childWidth: innerWidth, settings: settings })), effectiveDisplayRenderer.type === 'ansi' && (_jsxs(_Fragment, { children: [_jsx(AnsiOutputText, { data: effectiveDisplayRenderer.data, availableTerminalHeight: shellCapHeight, maxWidth: innerWidth }), effectiveDisplayRenderer.stats && (_jsx(ShellStatsBar, { ...effectiveDisplayRenderer.stats, displayHeight: shellCapHeight }))] })), effectiveDisplayRenderer.type === 'string' && (_jsx(StringResultRenderer, { data: effectiveDisplayRenderer.data, renderAsMarkdown: renderOutputAsMarkdown, availableHeight: shellStringCapHeight, childWidth: innerWidth }))] }) })), isThisShellFocused && config && (_jsx(Box, { paddingLeft: STATUS_INDICATOR_WIDTH, marginTop: 1, children: _jsx(ShellInputPrompt, { activeShellPtyId: activeShellPtyId ?? null, focus: embeddedShellFocused }) }))] }));
};
const ToolInfo = ({ name, description, status, emphasis, }) => {
    const nameColor = React.useMemo(() => {
        switch (emphasis) {
            case 'high':
                return theme.text.primary;
            case 'medium':
                return theme.text.primary;
            case 'low':
                return theme.text.secondary;
            default: {
                const exhaustiveCheck = emphasis;
                return exhaustiveCheck;
            }
        }
    }, [emphasis]);
    return (_jsx(Box, { flexGrow: 1, children: _jsxs(Text, { wrap: "truncate-end", strikethrough: status === ToolCallStatus.Canceled, children: [_jsx(Text, { color: nameColor, bold: true, children: name }), ' ', _jsx(Text, { color: theme.text.secondary, children: description })] }) }));
};
const TrailingIndicator = () => (_jsxs(Text, { color: theme.text.primary, wrap: "truncate", children: [' ', "\u2190"] }));
//# sourceMappingURL=ToolMessage.js.map