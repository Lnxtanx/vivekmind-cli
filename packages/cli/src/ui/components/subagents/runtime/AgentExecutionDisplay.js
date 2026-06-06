import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { COLOR_OPTIONS } from '../constants.js';
import { fmtDuration } from '../utils.js';
import { ToolConfirmationMessage } from '../../messages/ToolConfirmationMessage.js';
import { getCachedStringWidth, sliceTextByVisualHeight, toCodePoints, } from '../../../utils/textUtils.js';
const getStatusColor = (status) => {
    switch (status) {
        case 'running':
        case 'executing':
        case 'awaiting_approval':
            return theme.status.warning;
        case 'completed':
        case 'success':
            return theme.status.success;
        case 'background':
            return theme.text.secondary;
        case 'cancelled':
            return theme.status.warning;
        case 'failed':
            return theme.status.error;
        default:
            return theme.text.secondary;
    }
};
const getStatusText = (status) => {
    switch (status) {
        case 'running':
            return 'Running';
        case 'completed':
            return 'Completed';
        case 'background':
            return 'Running in background';
        case 'cancelled':
            return 'User Cancelled';
        case 'failed':
            return 'Failed';
        default:
            return 'Unknown';
    }
};
const BackgroundManageHint = () => (_jsx(Text, { color: theme.text.secondary, children: " (\u2193 to manage)" }));
const MAX_TOOL_CALLS = 5;
const MAX_VERBOSE_TOOL_CALLS = 12;
const MAX_TASK_PROMPT_LINES = 5;
const DEFAULT_DETAIL_HEIGHT = 18;
// Approximate fixed-row cost of the default/verbose layout, derived from the
// JSX structure below: 1 header + (1 "Task Detail:" label + 1 internal gap +
// optional 1 "...N task lines hidden..." footer) + (1 "Tools:" label + 1
// marginBottom) + 1 footer + 3 inter-section gaps. We subtract this from the
// parent-provided `availableHeight` so the budget for the prompt and
// tool-call lists actually fits inside the assigned frame.
const RUNNING_FIXED_OVERHEAD = 10;
// In completed/cancelled/failed mode we lose the running footer but gain the
// ExecutionSummary block (header + 3 rows) and the ToolUsage block (header +
// up to 2 wrapped rows) plus an extra inter-block gap, so the overhead grows.
// Calibrated against the running→completed transition test: assigning <22
// here lets the completed expanded frame edge past availableHeight when the
// SubAgent finishes mid-expand.
const COMPLETED_FIXED_OVERHEAD = 22;
// "Status icon + name + description" + "truncated output" — each tool call
// commits two visual rows in default/verbose mode.
const ROWS_PER_TOOL_CALL = 2;
function truncateToVisualWidth(text, maxWidth) {
    const visualWidth = Math.max(1, Math.floor(maxWidth));
    const ellipsis = '...';
    const ellipsisWidth = getCachedStringWidth(ellipsis);
    let currentWidth = 0;
    let result = '';
    for (const char of toCodePoints(text)) {
        const charWidth = Math.max(getCachedStringWidth(char), 1);
        if (currentWidth + charWidth > visualWidth) {
            const availableWidth = Math.max(0, visualWidth - ellipsisWidth);
            let trimmed = '';
            let trimmedWidth = 0;
            for (const trimmedChar of toCodePoints(result)) {
                const trimmedCharWidth = Math.max(getCachedStringWidth(trimmedChar), 1);
                if (trimmedWidth + trimmedCharWidth > availableWidth) {
                    break;
                }
                trimmed += trimmedChar;
                trimmedWidth += trimmedCharWidth;
            }
            return trimmed + ellipsis;
        }
        result += char;
        currentWidth += charWidth;
    }
    return result;
}
/**
 * Component to display subagent execution progress and results.
 * This is now a pure component that renders the provided SubagentExecutionResultDisplay data.
 * Real-time updates are handled by the parent component updating the data prop.
 */
export const AgentExecutionDisplay = ({ data, availableHeight, childWidth, config, isFocused = true, isWaitingForOtherApproval = false, }) => {
    const [displayMode, setDisplayMode] = React.useState('compact');
    const detailHeight = Math.max(4, Math.floor(availableHeight ?? DEFAULT_DETAIL_HEIGHT));
    // Treat `availableHeight` as the *total* component budget. Subtract the
    // fixed overhead (header, section labels, gaps, footer/result block) before
    // splitting the remainder between the prompt preview and the tool-call
    // list. This guarantees the rendered frame doesn't grow past the budget the
    // parent layout assigned us, which is the precondition for Ink to keep the
    // SubAgent display inside its static slot instead of clearing+redrawing.
    const fixedOverhead = data.status === 'running'
        ? RUNNING_FIXED_OVERHEAD
        : COMPLETED_FIXED_OVERHEAD;
    const renderableBudget = Math.max(2, detailHeight - fixedOverhead);
    // Prompt gets ~1/3 of the remainder, tool-call list gets the rest. Both are
    // clamped to >=1 so we always render at least one of each kind, even in
    // pathological "availableHeight smaller than overhead" cases.
    const promptBudget = Math.max(1, Math.floor(renderableBudget / 3));
    const toolBudget = Math.max(1, Math.floor((renderableBudget - promptBudget) / ROWS_PER_TOOL_CALL));
    const maxTaskPromptLines = displayMode === 'verbose'
        ? Math.min(8, promptBudget)
        : Math.min(MAX_TASK_PROMPT_LINES, promptBudget);
    const maxToolCalls = displayMode === 'verbose'
        ? Math.min(MAX_VERBOSE_TOOL_CALLS, toolBudget)
        : Math.min(MAX_TOOL_CALLS, toolBudget);
    const agentColor = useMemo(() => {
        const colorOption = COLOR_OPTIONS.find((option) => option.name === data.subagentColor);
        return colorOption?.value || theme.text.accent;
    }, [data.subagentColor]);
    // Slice the prompt once at the parent so the rendered TaskPromptSection
    // and the footer's "ctrl+f to show more" hint share the same source of
    // truth. Counting `data.taskPrompt.split('\n').length` would only see hard
    // newlines and miss soft-wrapped overflow, so a long single-line prompt
    // could be visually truncated without surfacing the hint.
    const promptChildWidth = Math.max(1, childWidth - 2);
    const slicedPrompt = useMemo(() => sliceTextByVisualHeight(data.taskPrompt, maxTaskPromptLines, promptChildWidth, { minHeight: 1, overflowDirection: 'bottom' }), [data.taskPrompt, maxTaskPromptLines, promptChildWidth]);
    const footerText = React.useMemo(() => {
        // This component only listens to keyboard shortcut events when the subagent is running
        if (data.status !== 'running')
            return '';
        if (displayMode === 'default') {
            const hasMoreLines = slicedPrompt.hiddenLinesCount > 0;
            const hasMoreToolCalls = data.toolCalls && data.toolCalls.length > maxToolCalls;
            if (hasMoreToolCalls || hasMoreLines) {
                return 'Press ctrl+e to show less, ctrl+f to show more.';
            }
            return 'Press ctrl+e to show less.';
        }
        if (displayMode === 'verbose') {
            return 'Press ctrl+f to show less.';
        }
        return '';
    }, [
        displayMode,
        data.status,
        data.toolCalls,
        slicedPrompt.hiddenLinesCount,
        maxToolCalls,
    ]);
    // Handle keyboard shortcuts to control display mode. Scope the listener to
    // the running subagent that currently holds focus — `data.status` rules
    // out completed/historical instances mounted in scrollback, and
    // `isFocused` rules out *parallel* running subagents that share the live
    // viewport. Without the focus gate, two SubAgents running side by side
    // would both toggle on a single Ctrl+E / Ctrl+F press and the resulting
    // dual-reflow brings back the flicker this component is meant to
    // prevent.
    useKeypress((key) => {
        if (key.ctrl && key.name === 'e') {
            // ctrl+e toggles between compact and default
            setDisplayMode((current) => current === 'compact' ? 'default' : 'compact');
        }
        else if (key.ctrl && key.name === 'f') {
            // ctrl+f toggles between default and verbose
            setDisplayMode((current) => current === 'default' ? 'verbose' : 'default');
        }
    }, { isActive: data.status === 'running' && isFocused });
    if (displayMode === 'compact') {
        return (_jsxs(Box, { flexDirection: "column", children: [!data.pendingConfirmation && (_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { bold: true, color: agentColor, children: data.subagentName }), _jsx(StatusDot, { status: data.status }), _jsx(StatusIndicator, { status: data.status }), data.status === 'background' && _jsx(BackgroundManageHint, {})] })), data.status === 'running' && (_jsxs(_Fragment, { children: [data.toolCalls && data.toolCalls.length > 0 && (_jsxs(Box, { flexDirection: "column", children: [_jsx(ToolCallItem, { toolCall: data.toolCalls[data.toolCalls.length - 1], compact: true }), data.toolCalls.length > 1 && !data.pendingConfirmation && (_jsx(Box, { flexDirection: "row", paddingLeft: 4, children: _jsxs(Text, { color: theme.text.secondary, children: ["+", data.toolCalls.length - 1, " more tool calls (ctrl+e to expand)"] }) }))] })), data.pendingConfirmation && (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 1, children: [isWaitingForOtherApproval && (_jsx(Box, { marginBottom: 0, children: _jsx(Text, { color: theme.text.secondary, dimColor: true, children: "\u23F3 Waiting for other approval..." }) })), _jsx(ToolConfirmationMessage, { confirmationDetails: data.pendingConfirmation, isFocused: isFocused, availableTerminalHeight: availableHeight, contentWidth: childWidth - 4, compactMode: true, config: config })] }))] })), data.status === 'completed' && data.executionSummary && (_jsx(Box, { flexDirection: "row", marginTop: 1, children: _jsxs(Text, { color: theme.text.secondary, children: ["Execution Summary: ", data.executionSummary.totalToolCalls, " tool uses \u00B7 ", data.executionSummary.totalTokens.toLocaleString(), " tokens \u00B7 ", fmtDuration(data.executionSummary.totalDurationMs)] }) })), data.status === 'failed' && (_jsx(Box, { flexDirection: "row", marginTop: 1, children: _jsxs(Text, { color: theme.status.error, children: ["Failed: ", data.terminateReason] }) }))] }));
    }
    // Default and verbose modes use normal layout
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, gap: 1, children: [_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { bold: true, color: agentColor, children: data.subagentName }), _jsx(StatusDot, { status: data.status }), _jsx(StatusIndicator, { status: data.status }), data.status === 'background' && _jsx(BackgroundManageHint, {})] }), _jsx(TaskPromptSection, { slicedPrompt: slicedPrompt, displayMode: displayMode, maxVisualLines: maxTaskPromptLines }), data.status === 'running' &&
                data.toolCalls &&
                data.toolCalls.length > 0 && (_jsx(Box, { flexDirection: "column", children: _jsx(ToolCallsList, { toolCalls: data.toolCalls, displayMode: displayMode, maxToolCalls: maxToolCalls, childWidth: childWidth - 2 }) })), data.pendingConfirmation && (_jsxs(Box, { flexDirection: "column", children: [isWaitingForOtherApproval && (_jsx(Box, { marginBottom: 0, children: _jsx(Text, { color: theme.text.secondary, dimColor: true, children: "\u23F3 Waiting for other approval..." }) })), _jsx(ToolConfirmationMessage, { confirmationDetails: data.pendingConfirmation, config: config, isFocused: isFocused, availableTerminalHeight: availableHeight, contentWidth: childWidth - 4, compactMode: true })] })), (data.status === 'completed' ||
                data.status === 'failed' ||
                data.status === 'cancelled') && (_jsx(ResultsSection, { data: data, displayMode: displayMode, maxToolCalls: maxToolCalls, childWidth: childWidth - 2 })), footerText && (_jsx(Box, { flexDirection: "row", children: _jsx(Text, { color: theme.text.secondary, children: footerText }) }))] }));
};
/**
 * Task prompt section. Receives the already-sliced prompt from the parent so
 * footer hint and section content share one source of truth for whether
 * content was hidden (covers soft-wrapped overflow in addition to explicit
 * newlines).
 */
const TaskPromptSection = ({ slicedPrompt, displayMode, maxVisualLines }) => {
    const shouldTruncate = slicedPrompt.hiddenLinesCount > 0;
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { color: theme.text.primary, children: "Task Detail: " }), shouldTruncate && displayMode !== 'compact' && (_jsxs(Text, { color: theme.text.secondary, children: [' ', "Showing the first ", maxVisualLines, " visual lines."] }))] }), _jsx(Box, { paddingLeft: 1, children: _jsx(Text, { wrap: "wrap", children: slicedPrompt.text }) }), slicedPrompt.hiddenLinesCount > 0 && (_jsx(Box, { paddingLeft: 1, children: _jsxs(Text, { color: theme.text.secondary, wrap: "truncate", children: ["... last ", slicedPrompt.hiddenLinesCount, " task line", slicedPrompt.hiddenLinesCount === 1 ? '' : 's', " hidden ..."] }) }))] }));
};
/**
 * Status dot component with similar height as text
 */
const StatusDot = ({ status }) => (_jsx(Box, { marginLeft: 1, marginRight: 1, children: _jsx(Text, { color: getStatusColor(status), children: "\u25CF" }) }));
/**
 * Status indicator component
 */
const StatusIndicator = ({ status }) => {
    const color = getStatusColor(status);
    const text = getStatusText(status);
    return _jsx(Text, { color: color, children: text });
};
/**
 * Tool calls list - format consistent with ToolInfo in ToolMessage.tsx
 */
const ToolCallsList = ({ toolCalls, displayMode, maxToolCalls, childWidth }) => {
    const calls = toolCalls || [];
    const displayLimit = Math.max(1, Math.floor(maxToolCalls));
    const shouldTruncate = calls.length > displayLimit;
    const displayCalls = calls.slice(-displayLimit);
    // Reverse the order to show most recent first
    const reversedDisplayCalls = [...displayCalls].reverse();
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { flexDirection: "row", marginBottom: 1, children: [_jsx(Text, { color: theme.text.primary, children: "Tools:" }), shouldTruncate && displayMode !== 'compact' && (_jsxs(Text, { color: theme.text.secondary, children: [' ', "Showing the last ", displayCalls.length, " of ", calls.length, " tools."] }))] }), reversedDisplayCalls.map((toolCall, index) => (_jsx(ToolCallItem, { toolCall: toolCall, childWidth: childWidth }, `${toolCall.name}-${index}`)))] }));
};
/**
 * Individual tool call item - consistent with ToolInfo format
 */
const ToolCallItem = ({ toolCall, compact = false, childWidth = 80 }) => {
    const STATUS_INDICATOR_WIDTH = 3;
    const textWidth = Math.max(8, childWidth - STATUS_INDICATOR_WIDTH - 1);
    // Map subagent status to ToolCallStatus-like display
    const statusIcon = React.useMemo(() => {
        const color = getStatusColor(toolCall.status);
        switch (toolCall.status) {
            case 'executing':
                return _jsx(Text, { color: color, children: "\u22B7" }); // Using same as ToolMessage
            case 'awaiting_approval':
                return _jsx(Text, { color: theme.status.warning, children: "?" });
            case 'success':
                return _jsx(Text, { color: color, children: "\u2713" });
            case 'failed':
                return (_jsx(Text, { color: color, bold: true, children: "x" }));
            default:
                return _jsx(Text, { color: color, children: "o" });
        }
    }, [toolCall.status]);
    const description = React.useMemo(() => {
        if (!toolCall.description)
            return '';
        const firstLine = toolCall.description.split('\n')[0];
        return truncateToVisualWidth(firstLine, textWidth);
    }, [toolCall.description, textWidth]);
    // Get first line of resultDisplay for truncated output
    const truncatedOutput = React.useMemo(() => {
        if (!toolCall.resultDisplay)
            return '';
        const firstLine = toolCall.resultDisplay.split('\n')[0];
        return truncateToVisualWidth(firstLine, textWidth);
    }, [toolCall.resultDisplay, textWidth]);
    return (_jsxs(Box, { flexDirection: "column", paddingLeft: 1, marginBottom: 0, children: [_jsxs(Box, { flexDirection: "row", children: [_jsx(Box, { minWidth: STATUS_INDICATOR_WIDTH, children: statusIcon }), _jsxs(Text, { wrap: "truncate-end", children: [_jsx(Text, { children: toolCall.name }), ' ', _jsx(Text, { color: theme.text.secondary, children: description }), toolCall.error && (_jsxs(Text, { color: theme.status.error, children: [" - ", toolCall.error] }))] })] }), !compact && truncatedOutput && (_jsx(Box, { flexDirection: "row", paddingLeft: STATUS_INDICATOR_WIDTH, children: _jsx(Text, { color: theme.text.secondary, children: truncatedOutput }) }))] }));
};
/**
 * Execution summary details component
 */
const ExecutionSummaryDetails = ({ data, displayMode: _displayMode }) => {
    const stats = data.executionSummary;
    if (!stats) {
        return (_jsx(Box, { flexDirection: "column", paddingLeft: 1, children: _jsx(Text, { color: theme.text.secondary, children: "\u2022 No summary available" }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [_jsxs(Text, { children: ["\u2022 ", _jsxs(Text, { children: ["Duration: ", fmtDuration(stats.totalDurationMs)] })] }), _jsxs(Text, { children: ["\u2022 ", _jsxs(Text, { children: ["Rounds: ", stats.rounds] })] }), _jsxs(Text, { children: ["\u2022 ", _jsxs(Text, { children: ["Tokens: ", stats.totalTokens.toLocaleString()] })] })] }));
};
/**
 * Tool usage statistics component
 */
const ToolUsageStats = ({ executionSummary }) => {
    if (!executionSummary) {
        return (_jsx(Box, { flexDirection: "column", paddingLeft: 1, children: _jsx(Text, { color: theme.text.secondary, children: "\u2022 No tool usage data available" }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", paddingLeft: 1, children: [_jsxs(Text, { children: ["\u2022 ", _jsx(Text, { children: "Total Calls:" }), " ", executionSummary.totalToolCalls] }), _jsxs(Text, { children: ["\u2022 ", _jsx(Text, { children: "Success Rate:" }), ' ', _jsxs(Text, { color: theme.status.success, children: [executionSummary.successRate.toFixed(1), "%"] }), ' ', "(", _jsxs(Text, { color: theme.status.success, children: [executionSummary.successfulToolCalls, " success"] }), ",", ' ', _jsxs(Text, { color: theme.status.error, children: [executionSummary.failedToolCalls, " failed"] }), ")"] })] }));
};
/**
 * Results section for completed executions - matches the clean layout from the image
 */
const ResultsSection = ({ data, displayMode, maxToolCalls, childWidth }) => (_jsxs(Box, { flexDirection: "column", gap: 1, children: [data.toolCalls && data.toolCalls.length > 0 && (_jsx(ToolCallsList, { toolCalls: data.toolCalls, displayMode: displayMode, maxToolCalls: maxToolCalls, childWidth: childWidth })), data.status === 'completed' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { flexDirection: "row", marginBottom: 1, children: _jsx(Text, { color: theme.text.primary, children: "Execution Summary:" }) }), _jsx(ExecutionSummaryDetails, { data: data, displayMode: displayMode })] })), data.status === 'completed' && data.executionSummary && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { flexDirection: "row", marginBottom: 1, children: _jsx(Text, { color: theme.text.primary, children: "Tool Usage:" }) }), _jsx(ToolUsageStats, { executionSummary: data.executionSummary })] })), data.status === 'cancelled' && (_jsx(Box, { flexDirection: "row", children: _jsx(Text, { color: theme.status.warning, children: "\u23F9 User Cancelled" }) })), data.status === 'failed' && (_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { color: theme.status.error, children: "Task Failed: " }), _jsx(Text, { color: theme.status.error, children: data.terminateReason })] }))] }));
//# sourceMappingURL=AgentExecutionDisplay.js.map