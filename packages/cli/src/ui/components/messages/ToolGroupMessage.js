import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { useMemo, useRef } from 'react';
import { ToolCallStatus } from '../../types.js';
import { ToolMessage } from './ToolMessage.js';
import { ToolConfirmationMessage } from './ToolConfirmationMessage.js';
import { CompactToolGroupDisplay } from './CompactToolGroupDisplay.js';
import { theme } from '../../semantic-colors.js';
import { SHELL_COMMAND_NAME, SHELL_NAME } from '../../constants.js';
import { useConfig } from '../../contexts/ConfigContext.js';
import { useCompactMode } from '../../contexts/CompactModeContext.js';
function isAgentWithPendingConfirmation(rd) {
    return (typeof rd === 'object' &&
        rd !== null &&
        'type' in rd &&
        rd.type === 'task_execution' &&
        rd.pendingConfirmation !== undefined);
}
function isRunningAgent(rd) {
    return (typeof rd === 'object' &&
        rd !== null &&
        'type' in rd &&
        rd.type === 'task_execution' &&
        rd.status === 'running');
}
// Main component renders the border and maps the tools using ToolMessage
export const ToolGroupMessage = ({ toolCalls, availableTerminalHeight, contentWidth, isFocused = true, activeShellPtyId, embeddedShellFocused, memoryWriteCount, memoryReadCount, isUserInitiated, compactLabel, }) => {
    const config = useConfig();
    const { compactMode } = useCompactMode();
    const hasConfirmingTool = toolCalls.some((t) => t.status === ToolCallStatus.Confirming);
    const hasErrorTool = toolCalls.some((t) => t.status === ToolCallStatus.Error);
    const isEmbeddedShellFocused = embeddedShellFocused &&
        toolCalls.some((t) => t.ptyId === activeShellPtyId && t.status === ToolCallStatus.Executing);
    // useMemo must be called unconditionally (Rules of Hooks) — before any early return
    // only prompt for tool approval on the first 'confirming' tool in the list
    // note, after the CTA, this automatically moves over to the next 'confirming' tool
    const toolAwaitingApproval = useMemo(() => toolCalls.find((tc) => tc.status === ToolCallStatus.Confirming), [toolCalls]);
    // Detect if this is a "memory-only" group (all tool calls are memory ops)
    const isMemoryOnlyGroup = useMemo(() => toolCalls.length > 0 && toolCalls.every((t) => t.isMemoryOp != null), [toolCalls]);
    const allComplete = useMemo(() => toolCalls.every((t) => t.status === ToolCallStatus.Success ||
        t.status === ToolCallStatus.Error), [toolCalls]);
    // Determine which subagent tools currently have a pending confirmation.
    // Must be called unconditionally (Rules of Hooks) — before any early return.
    const subagentsAwaitingApproval = useMemo(() => toolCalls.filter((tc) => isAgentWithPendingConfirmation(tc.resultDisplay)), [toolCalls]);
    // "First-come, first-served" focus lock: once a subagent's confirmation
    // appears, it keeps keyboard focus until the user resolves it. Only then
    // does focus move to the next pending subagent. This prevents the jarring
    // experience of focus jumping away while the user is mid-selection.
    const focusedSubagentRef = useRef(null);
    const stillPending = subagentsAwaitingApproval.some((tc) => tc.callId === focusedSubagentRef.current);
    if (!stillPending) {
        // Release stale lock and promote the next pending subagent (if any).
        focusedSubagentRef.current = subagentsAwaitingApproval[0]?.callId ?? null;
    }
    const focusedSubagentCallId = focusedSubagentRef.current;
    // When no subagent has a pending confirmation, fall back to the *first*
    // running subagent for Ctrl+E/Ctrl+F shortcut focus. "First" (array order)
    // is the oldest — the one most likely to have accumulated tool calls and
    // display the "+N more (ctrl+e to expand)" hint.
    const runningSubagentCallId = useMemo(() => toolCalls.find((tc) => isRunningAgent(tc.resultDisplay))?.callId ?? null, [toolCalls]);
    // Pending confirmation takes strict priority over running fallback.
    const keyboardFocusedSubagentCallId = focusedSubagentCallId ?? runningSubagentCallId;
    // Compact mode: entire group → single line summary
    // Force-expand when: user must interact (Confirming or subagent pending
    // confirmation), tool errored, shell is focused, or user-initiated
    const hasSubagentPendingConfirmation = subagentsAwaitingApproval.length > 0;
    const showCompact = compactMode &&
        !hasConfirmingTool &&
        !hasSubagentPendingConfirmation &&
        !hasErrorTool &&
        !isEmbeddedShellFocused &&
        !isUserInitiated;
    if (showCompact) {
        return (_jsx(CompactToolGroupDisplay, { toolCalls: toolCalls, contentWidth: contentWidth, compactLabel: compactLabel }));
    }
    // Full expanded view
    const hasPending = !toolCalls.every((t) => t.status === ToolCallStatus.Success);
    const isShellCommand = toolCalls.some((t) => t.name === SHELL_COMMAND_NAME || t.name === SHELL_NAME);
    const borderColor = isShellCommand || isEmbeddedShellFocused
        ? theme.ui.symbol
        : hasPending
            ? theme.status.warning
            : theme.border.default;
    const staticHeight = /* border */ 2 + /* marginBottom */ 1;
    // account for border (2 chars) and padding (2 chars)
    const innerWidth = contentWidth - 4;
    let countToolCallsWithResults = 0;
    for (const tool of toolCalls) {
        if (tool.resultDisplay !== undefined && tool.resultDisplay !== '') {
            countToolCallsWithResults++;
        }
    }
    const countOneLineToolCalls = toolCalls.length - countToolCallsWithResults;
    const availableTerminalHeightPerToolMessage = availableTerminalHeight
        ? Math.max(Math.floor((availableTerminalHeight - staticHeight - countOneLineToolCalls) /
            Math.max(1, countToolCallsWithResults)), 1)
        : undefined;
    // For completed memory-only groups, show a compact summary instead of individual tool calls
    if (isMemoryOnlyGroup && allComplete) {
        const readCount = memoryReadCount ?? 0;
        const writeCount = memoryWriteCount ?? 0;
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", width: contentWidth, borderColor: theme.border.default, children: [readCount > 0 && (_jsx(Box, { paddingLeft: 1, children: _jsxs(Text, { dimColor: true, children: ['● ', "Recalled ", readCount, " ", readCount === 1 ? 'memory' : 'memories'] }) })), writeCount > 0 && (_jsx(Box, { paddingLeft: 1, children: _jsxs(Text, { dimColor: true, children: ['● ', "Wrote ", writeCount, " ", writeCount === 1 ? 'memory' : 'memories'] }) }))] }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", 
        /*
          This width constraint is highly important and protects us from an Ink rendering bug.
          Since the ToolGroup can typically change rendering states frequently, it can cause
          Ink to render the border of the box incorrectly and span multiple lines and even
          cause tearing.
        */
        width: contentWidth, borderDimColor: hasPending && (!isShellCommand || !isEmbeddedShellFocused), borderColor: borderColor, gap: 1, children: [!isMemoryOnlyGroup &&
                ((memoryWriteCount ?? 0) > 0 || (memoryReadCount ?? 0) > 0) &&
                (() => {
                    const parts = [];
                    if ((memoryReadCount ?? 0) > 0) {
                        const n = memoryReadCount;
                        parts.push(`Recalled ${n} ${n === 1 ? 'memory' : 'memories'}`);
                    }
                    if ((memoryWriteCount ?? 0) > 0) {
                        const n = memoryWriteCount;
                        parts.push(`Wrote ${n} ${n === 1 ? 'memory' : 'memories'}`);
                    }
                    return (_jsx(Box, { paddingLeft: 1, children: _jsxs(Text, { dimColor: true, children: ["\u25CF ", parts.join(', ')] }) }));
                })(), toolCalls.map((tool) => {
                const isConfirming = toolAwaitingApproval?.callId === tool.callId;
                // A subagent's inline confirmation should only receive keyboard focus
                // when (1) there is no direct tool-level confirmation active, and (2)
                // this tool currently holds the subagent keyboard focus. Pending
                // confirmations keep the existing first-come focus lock; otherwise the
                // first running subagent owns Ctrl+E/Ctrl+F so the compact hint remains
                // actionable without making parallel subagents toggle in lock-step.
                const isSubagentFocused = isFocused &&
                    !toolAwaitingApproval &&
                    keyboardFocusedSubagentCallId === tool.callId;
                // Show the waiting indicator only when this subagent genuinely has a
                // pending confirmation AND another subagent holds the focus lock.
                const isWaitingForOtherApproval = isAgentWithPendingConfirmation(tool.resultDisplay) &&
                    focusedSubagentCallId !== null &&
                    focusedSubagentCallId !== tool.callId;
                return (_jsxs(Box, { flexDirection: "column", minHeight: 1, children: [_jsx(Box, { flexDirection: "row", alignItems: "center", children: _jsx(ToolMessage, { ...tool, availableTerminalHeight: availableTerminalHeightPerToolMessage, contentWidth: innerWidth, emphasis: isConfirming
                                    ? 'high'
                                    : toolAwaitingApproval
                                        ? 'low'
                                        : 'medium', activeShellPtyId: activeShellPtyId, embeddedShellFocused: embeddedShellFocused, config: config, forceShowResult: isUserInitiated ||
                                    tool.status === ToolCallStatus.Confirming ||
                                    tool.status === ToolCallStatus.Error ||
                                    isAgentWithPendingConfirmation(tool.resultDisplay), isFocused: isSubagentFocused, isWaitingForOtherApproval: isWaitingForOtherApproval }) }), tool.status === ToolCallStatus.Confirming &&
                            isConfirming &&
                            tool.confirmationDetails && (_jsx(ToolConfirmationMessage, { confirmationDetails: tool.confirmationDetails, config: config, isFocused: isFocused, availableTerminalHeight: availableTerminalHeightPerToolMessage, contentWidth: innerWidth }))] }, tool.callId));
            })] }));
};
//# sourceMappingURL=ToolGroupMessage.js.map