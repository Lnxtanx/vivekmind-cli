import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useBackgroundTaskViewState, useBackgroundTaskViewActions, } from '../../contexts/BackgroundTaskViewContext.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import { MaxSizedBox } from '../shared/MaxSizedBox.js';
import { theme } from '../../semantic-colors.js';
import { useConfig } from '../../contexts/ConfigContext.js';
import { buildBackgroundEntryLabel, ToolDisplayNames, ToolNames, } from '@vivekmind/core';
import { formatDuration, formatTokenCount } from '../../utils/formatters.js';
import { entryId, } from '../../hooks/useBackgroundTaskView.js';
// Tool-name → display-name lookup (`run_shell_command` → `Shell`).
const TOOL_DISPLAY_BY_NAME = Object.fromEntries(Object.keys(ToolNames).map((key) => [
    ToolNames[key],
    ToolDisplayNames[key],
]));
function formatActivityLabel(name, description) {
    const display = TOOL_DISPLAY_BY_NAME[name] ?? name;
    const singleLineDesc = description
        ? description.replace(/\s*\n\s*/g, ' ').trim()
        : '';
    return singleLineDesc ? `${display}(${singleLineDesc})` : display;
}
const STATUS_VERBS = {
    running: 'Running',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Stopped',
};
function terminalStatusPresentation(status) {
    switch (status) {
        case 'paused':
            return {
                icon: '\u23F8',
                color: theme.status.warning,
                labelColor: theme.status.warningDim,
            };
        case 'completed':
            return {
                icon: '\u2714',
                color: theme.status.success,
                labelColor: theme.text.secondary,
            };
        case 'failed':
            return {
                icon: '\u2716',
                color: theme.status.error,
                labelColor: theme.status.errorDim,
            };
        case 'cancelled':
            return {
                icon: '\u2716',
                color: theme.status.warning,
                labelColor: theme.status.warningDim,
            };
        default:
            return null;
    }
}
function rowLabel(entry) {
    switch (entry.kind) {
        case 'agent':
            return buildBackgroundEntryLabel(entry, { includePrefix: false });
        case 'shell':
            // Shell / monitor prefixes mirror the dialog's "section" visual hint
            // without needing per-kind section headers (which would complicate
            // the windowing math). Long commands / descriptions wrap (ListBody
            // renders rows with plain `<Text>`, no truncation helper), which
            // is acceptable for the dialog's information-density profile —
            // adding `wrap="truncate-end"` here would hide context the user
            // explicitly opened the dialog to see.
            return `[shell] ${entry.command}`;
        case 'monitor':
            return `[monitor] ${entry.description}`;
        default: {
            const _exhaustive = entry;
            throw new Error(`rowLabel: unknown DialogEntry kind: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
function elapsedFor(entry) {
    const elapsedMs = Math.max(0, (entry.endTime ?? Date.now()) - entry.startTime);
    // Round down to whole seconds — the detail subtitle is a glanceable
    // indicator, not a stopwatch, and sub-second precision flickers distract
    // from the actual status change.
    const wholeSeconds = Math.floor(elapsedMs / 1000);
    return formatDuration(wholeSeconds * 1000, { hideTrailingZeros: true });
}
// Manually truncate to an exact cell width so each row lines up with the
// others regardless of content length. Relying on Ink's `wrap="truncate-end"`
// inside MaxSizedBox produced inconsistent row widths when some rows fit and
// others needed ellipsis, breaking the left-column alignment of the prefix.
function truncateToWidth(text, maxWidth) {
    if (maxWidth <= 0)
        return '';
    if (stringWidth(text) <= maxWidth)
        return text;
    const ellipsis = '…';
    const ellipsisWidth = stringWidth(ellipsis);
    const target = Math.max(0, maxWidth - ellipsisWidth);
    let width = 0;
    let result = '';
    for (const char of text) {
        const charWidth = stringWidth(char);
        if (width + charWidth > target)
            break;
        width += charWidth;
        result += char;
    }
    return result + ellipsis;
}
// ─── List mode ─────────────────────────────────────────────
const ListBody = ({ entries, selectedIndex, maxRows }) => {
    // Keep the "Background tasks (N)" section header rendered even when the
    // list is empty, so the overlay doesn't collapse into a single line of
    // empty-state text when the last task finishes while the dialog is open.
    if (entries.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { paddingX: 1, children: [_jsx(Text, { bold: true, children: "Background tasks" }), _jsx(Text, { color: theme.text.secondary, children: " (0)" })] }), _jsx(Box, { paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: "No tasks currently running" }) })] }));
    }
    // Window entries around selectedIndex. When the list fits, show
    // everything; otherwise centre the selection and clamp to the ends.
    // "+N more above/below" lines consume one row each on the respective
    // side, so subtract them from the available row budget.
    const fits = entries.length <= maxRows;
    const effectiveRows = Math.max(1, fits ? maxRows : maxRows - 2);
    const windowStart = fits
        ? 0
        : Math.max(0, Math.min(selectedIndex - Math.floor(effectiveRows / 2), entries.length - effectiveRows));
    const windowEnd = fits
        ? entries.length
        : Math.min(entries.length, windowStart + effectiveRows);
    const hiddenAbove = windowStart;
    const hiddenBelow = entries.length - windowEnd;
    const visible = entries.slice(windowStart, windowEnd);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { paddingX: 1, children: [_jsx(Text, { bold: true, children: "Background tasks" }), _jsxs(Text, { color: theme.text.secondary, children: [" (", entries.length, ")"] })] }), _jsxs(Box, { flexDirection: "column", children: [hiddenAbove > 0 && (_jsx(Box, { paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: `  ^ ${hiddenAbove} more above` }) })), visible.map((entry, visibleIdx) => {
                        const idx = windowStart + visibleIdx;
                        const isSelected = idx === selectedIndex;
                        const terminal = terminalStatusPresentation(entry.status);
                        const labelColor = isSelected
                            ? theme.text.accent
                            : terminal
                                ? terminal.labelColor
                                : theme.text.primary;
                        return (_jsxs(Box, { flexDirection: "row", paddingX: 1, children: [_jsx(Text, { color: isSelected ? theme.text.accent : undefined, children: isSelected ? '> ' : '  ' }), _jsx(Text, { color: labelColor, children: rowLabel(entry) })] }, entryId(entry)));
                    }), hiddenBelow > 0 && (_jsx(Box, { paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: `  v ${hiddenBelow} more below` }) }))] })] }));
};
// ─── Detail mode ───────────────────────────────────────────
const DetailBody = ({ entry, maxHeight, maxWidth }) => {
    switch (entry.kind) {
        case 'agent':
            return (_jsx(AgentDetailBody, { entry: entry, maxHeight: maxHeight, maxWidth: maxWidth }));
        case 'shell':
            return (_jsx(ShellDetailBody, { entry: entry, maxHeight: maxHeight, maxWidth: maxWidth }));
        case 'monitor':
            return (_jsx(MonitorDetailBody, { entry: entry, maxHeight: maxHeight, maxWidth: maxWidth }));
        default: {
            const _exhaustive = entry;
            throw new Error(`DetailBody: unknown DialogEntry kind: ${JSON.stringify(_exhaustive)}`);
        }
    }
};
const AgentDetailBody = ({ entry, maxHeight, maxWidth }) => {
    const title = `${entry.subagentType ?? 'Agent'} \u203A ${buildBackgroundEntryLabel(entry, { includePrefix: false })}`;
    const terminal = terminalStatusPresentation(entry.status);
    const dimSubtitleParts = [elapsedFor(entry)];
    if (entry.stats?.totalTokens) {
        dimSubtitleParts.push(`${formatTokenCount(entry.stats.totalTokens)} tokens`);
    }
    if (entry.stats?.toolUses !== undefined) {
        dimSubtitleParts.push(`${entry.stats.toolUses} tool${entry.stats.toolUses === 1 ? '' : 's'}`);
    }
    // Registry stores activities newest-last; keep that order so the live
    // row sits at the bottom of the Progress block. Cap at 5 in case the
    // registry ever raises its buffer.
    const activities = (entry.recentActivities ?? []).slice(-5);
    const blockedReason = entry.resumeBlockedReason;
    const hasError = Boolean(entry.error);
    const hasBlockedReason = Boolean(blockedReason);
    // Prompt: show at most 5 newline-delimited segments, each row truncated
    // to one visual line. Append an ellipsis if the source had more.
    const promptLines = entry.prompt ? entry.prompt.split('\n') : [];
    const visiblePromptLines = promptLines.slice(0, 5);
    const promptTruncated = promptLines.length > visiblePromptLines.length;
    if (promptTruncated && visiblePromptLines.length > 0) {
        const lastIdx = visiblePromptLines.length - 1;
        visiblePromptLines[lastIdx] =
            `${visiblePromptLines[lastIdx].trimEnd()}\u2026`;
    }
    return (_jsxs(MaxSizedBox, { maxHeight: maxHeight, maxWidth: maxWidth, overflowDirection: "bottom", children: [_jsx(Box, { children: _jsx(Text, { bold: true, color: theme.text.accent, children: title }) }), _jsxs(Box, { children: [terminal && (_jsx(Text, { color: terminal.color, children: `${terminal.icon} ${STATUS_VERBS[entry.status]} \u00B7 ` })), _jsx(Text, { color: theme.text.secondary, children: dimSubtitleParts.join(' \u00B7 ') })] }), activities.length > 0 && (_jsxs(Fragment, { children: [_jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, dimColor: true, children: "Progress" }) }), activities.map((a, i) => {
                        const isLast = i === activities.length - 1;
                        // ASCII `>` is unambiguously one cell wide in every terminal
                        // font, so `> ` (2 cells) aligns with a two-space indent on the
                        // other rows. Unicode chevrons rendered with inconsistent width
                        // broke alignment in some fonts.
                        const prefix = isLast ? '> ' : '  ';
                        const label = truncateToWidth(formatActivityLabel(a.name, a.description), Math.max(0, maxWidth - stringWidth(prefix)));
                        return (_jsx(Box, { children: _jsxs(Text, { color: isLast ? theme.text.primary : theme.text.secondary, children: [prefix, label] }) }, `${a.at}-${i}`));
                    })] })), visiblePromptLines.length > 0 && (_jsxs(Fragment, { children: [_jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, dimColor: true, children: "Prompt" }) }), visiblePromptLines.map((line, i) => (_jsx(Box, { children: _jsx(Text, { wrap: "truncate-end", children: line || ' ' }) }, `prompt-${i}`)))] })), hasBlockedReason && (_jsxs(Fragment, { children: [_jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, color: theme.status.error, children: "Resume blocked" }) }), _jsx(Box, { children: _jsx(Text, { color: theme.status.error, wrap: "wrap", children: blockedReason }) })] })), hasError && (_jsxs(Fragment, { children: [_jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, color: theme.status.error, children: "Error" }) }), _jsx(Box, { children: _jsx(Text, { color: theme.status.error, wrap: "wrap", children: entry.error }) })] }))] }));
};
const ShellDetailBody = ({ entry, maxHeight, maxWidth }) => {
    const title = `Shell \u203A ${entry.command}`;
    const terminal = terminalStatusPresentation(entry.status);
    const dimSubtitleParts = [elapsedFor(entry)];
    if (entry.pid !== undefined) {
        dimSubtitleParts.push(`pid ${entry.pid}`);
    }
    if (entry.status === 'completed' && entry.exitCode !== undefined) {
        dimSubtitleParts.push(`exit ${entry.exitCode}`);
    }
    const hasError = entry.status === 'failed' && Boolean(entry.error);
    return (_jsxs(MaxSizedBox, { maxHeight: maxHeight, maxWidth: maxWidth, overflowDirection: "bottom", children: [_jsx(Box, { children: _jsx(Text, { bold: true, color: theme.text.accent, children: title }) }), _jsxs(Box, { children: [terminal && (_jsx(Text, { color: terminal.color, children: `${terminal.icon} ${STATUS_VERBS[entry.status]} \u00B7 ` })), _jsx(Text, { color: theme.text.secondary, children: dimSubtitleParts.join(' \u00B7 ') })] }), _jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, dimColor: true, children: "Working dir" }) }), _jsx(Box, { children: _jsx(Text, { wrap: "truncate-end", children: entry.cwd }) }), _jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, dimColor: true, children: "Output file" }) }), _jsx(Box, { children: _jsx(Text, { wrap: "truncate-end", children: entry.outputPath }) }), hasError && (_jsxs(Fragment, { children: [_jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, color: theme.status.error, children: "Error" }) }), _jsx(Box, { children: _jsx(Text, { color: theme.status.error, wrap: "wrap", children: entry.error }) })] }))] }));
};
const MonitorDetailBody = ({ entry, maxHeight, maxWidth }) => {
    const title = `Monitor › ${entry.description}`;
    const terminal = terminalStatusPresentation(entry.status);
    const dimSubtitleParts = [elapsedFor(entry)];
    if (entry.pid !== undefined) {
        dimSubtitleParts.push(`pid ${entry.pid}`);
    }
    dimSubtitleParts.push(`${entry.eventCount} event${entry.eventCount === 1 ? '' : 's'}`);
    if (entry.droppedLines > 0) {
        dimSubtitleParts.push(`${entry.droppedLines} dropped`);
    }
    if (entry.exitCode !== undefined) {
        dimSubtitleParts.push(`exit ${entry.exitCode}`);
    }
    // `entry.error` is set on `failed` (spawn error) and on `completed`
    // when the monitor was auto-stopped (max events / idle timeout). Worth
    // surfacing whenever it exists, regardless of terminal status.
    const hasError = Boolean(entry.error);
    const errorIsFailure = entry.status === 'failed';
    const errorColor = errorIsFailure ? theme.status.error : theme.status.warning;
    return (_jsxs(MaxSizedBox, { maxHeight: maxHeight, maxWidth: maxWidth, overflowDirection: "bottom", children: [_jsx(Box, { children: _jsx(Text, { bold: true, color: theme.text.accent, children: title }) }), _jsxs(Box, { children: [terminal && (_jsx(Text, { color: terminal.color, children: `${terminal.icon} ${STATUS_VERBS[entry.status]} · ` })), _jsx(Text, { color: theme.text.secondary, children: dimSubtitleParts.join(' · ') })] }), _jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, dimColor: true, children: "Command" }) }), _jsx(Box, { children: _jsx(Text, { wrap: "truncate-end", children: entry.command }) }), hasError && (_jsxs(Fragment, { children: [_jsx(Box, {}), _jsx(Box, { children: _jsx(Text, { bold: true, color: errorColor, children: errorIsFailure ? 'Error' : 'Stopped because' }) }), _jsx(Box, { children: _jsx(Text, { color: errorColor, wrap: "wrap", children: entry.error }) })] }))] }));
};
export const BackgroundTasksDialog = ({ availableTerminalHeight, terminalWidth, }) => {
    const { entries, selectedIndex, dialogOpen, dialogMode } = useBackgroundTaskViewState();
    const { moveSelectionUp, moveSelectionDown, closeDialog, enterDetail, exitDetail, cancelSelected, resumeSelected, } = useBackgroundTaskViewActions();
    const config = useConfig();
    // Progress and Prompt are each self-capped at 5 rows inside DetailBody,
    // so the body never grows unbounded. Use all available height (minus the
    // dialog chrome) as the MaxSizedBox budget so nothing gets clipped just
    // because the terminal is short. Chrome = border(2) + title(1) + two
    // marginTops(2) + hint(1) = 6 rows.
    const detailContentHeight = Math.max(10, availableTerminalHeight - 6);
    // Rounded border + paddingX=1 on the outer Box ≈ 4 horizontal cells.
    const detailContentWidth = Math.max(10, terminalWidth - 4);
    // List mode row budget: terminal height minus chrome (border 2 + title 1
    // + two marginTops 2 + hint 1) and list header ("N active agents" 1 +
    // marginTop 1 + "Background tasks (N)" 1) = 10.
    const listMaxRows = Math.max(3, availableTerminalHeight - 10);
    // Activity tick — bumped whenever the watched agent emits an activity
    // update, *and* used as a useMemo dep below to refresh the live agent
    // entry from the registry. The snapshot in useBackgroundTaskView
    // intentionally only refreshes on `statusChange` (so the footer pill
    // and AppContainer stay quiet during heavy tool traffic), but the
    // detail body must see fresh `recentActivities` / `stats` between
    // those transitions — so we re-read from the registry here.
    const [activityTick, setActivityTick] = useState(0);
    const selectedEntry = useMemo(() => {
        const fromSnapshot = entries[selectedIndex] ?? null;
        if (!fromSnapshot)
            return fromSnapshot;
        // Re-read the entry from the registry on each activityTick so
        // detail-body fields the registry mutates between status transitions
        // are fresh. The snapshot in useBackgroundTaskView only refreshes on
        // statusChange (so the pill / AppContainer don't churn under heavy
        // tool / event traffic), so for the detail view we have to re-resolve
        // explicitly:
        //   - agent: `recentActivities` is reassigned by `appendActivity`,
        //     which fires `activityChange` (subscribed below).
        //   - monitor: `eventCount` / `droppedLines` are mutated by
        //     `emitEvent`, which intentionally does NOT fire `statusChange`
        //     to avoid per-event refresh churn. The 1s wall-clock tick below
        //     drives the recompute instead.
        // Shells don't mutate detail-visible fields between statusChange
        // events, so the snapshot stays correct for them.
        if (fromSnapshot.kind === 'agent') {
            const live = config.getBackgroundTaskRegistry().get(fromSnapshot.agentId);
            return live ? { ...live, kind: 'agent' } : fromSnapshot;
        }
        if (fromSnapshot.kind === 'monitor') {
            const live = config.getMonitorRegistry().get(fromSnapshot.monitorId);
            return live ? { ...live, kind: 'monitor' } : fromSnapshot;
        }
        return fromSnapshot;
        // activityTick is a dep on purpose: the registry mutation is invisible
        // to useMemo otherwise and we need to recompute on each activity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries, selectedIndex, config, activityTick]);
    const selectedEntryId = selectedEntry ? entryId(selectedEntry) : undefined;
    // Activity callback is agent-only — shells don't emit per-tool events.
    const selectedAgentIdForActivity = selectedEntry?.kind === 'agent' ? selectedEntry.agentId : undefined;
    useEffect(() => {
        if (!dialogOpen || dialogMode !== 'detail' || !selectedAgentIdForActivity)
            return;
        const registry = config.getBackgroundTaskRegistry();
        const onActivity = (entry) => {
            if (entry.agentId !== selectedAgentIdForActivity)
                return;
            setActivityTick((n) => n + 1);
        };
        registry.setActivityChangeCallback(onActivity);
        return () => registry.setActivityChangeCallback(undefined);
    }, [dialogOpen, dialogMode, config, selectedAgentIdForActivity]);
    // Wall-clock tick for the running agent's duration. Activity callbacks
    // fire when tools run, but duration needs to advance even when the agent
    // is quietly thinking — otherwise the "33s" line freezes between tool uses.
    const selectedStatus = selectedEntry?.status;
    useEffect(() => {
        if (!dialogOpen ||
            dialogMode !== 'detail' ||
            !selectedEntryId ||
            selectedStatus !== 'running')
            return;
        const id = setInterval(() => setActivityTick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [dialogOpen, dialogMode, selectedEntryId, selectedStatus]);
    // Auto-fallback to the list view when the selected agent reaches a
    // terminal state while the user is watching it live. We only exit on
    // the running → terminal *transition* — if the user deliberately
    // opened an already-completed entry, they stay on it. The detail
    // view itself renders terminal state fine, so this is a UX choice
    // (return focus to the running roster) rather than a correctness fix.
    const initialDetailStatusRef = useRef(null);
    useEffect(() => {
        if (!dialogOpen || dialogMode !== 'detail') {
            initialDetailStatusRef.current = null;
            return;
        }
        // Defensive fallback: if the viewed entry has somehow gone missing,
        // drop back to the list so we don't sit on a "No entry to show" screen.
        // Hitting this path now is unlikely — terminal entries stay in the
        // registry — but the entry could disappear if the registry is reset.
        if (!selectedEntryId) {
            initialDetailStatusRef.current = null;
            exitDetail();
            return;
        }
        const seen = initialDetailStatusRef.current;
        if (!seen || seen.entryId !== selectedEntryId) {
            // First render in detail mode for this entry — remember the status we
            // opened with so we can detect a transition away from 'running' later.
            if (selectedStatus) {
                initialDetailStatusRef.current = {
                    entryId: selectedEntryId,
                    status: selectedStatus,
                };
            }
            return;
        }
        if (seen.status === 'running' &&
            selectedStatus &&
            selectedStatus !== 'running') {
            exitDetail();
        }
    }, [dialogOpen, dialogMode, selectedEntryId, selectedStatus, exitDetail]);
    useKeypress((key) => {
        if (!dialogOpen)
            return;
        if (dialogMode === 'list') {
            if (key.name === 'up') {
                moveSelectionUp();
                return;
            }
            if (key.name === 'down') {
                moveSelectionDown();
                return;
            }
            if (key.name === 'return') {
                if (selectedEntry)
                    enterDetail();
                return;
            }
            if (key.name === 'escape' || key.name === 'left') {
                closeDialog();
                return;
            }
            if (key.sequence === 'r' && !key.ctrl && !key.meta) {
                void resumeSelected();
                return;
            }
            if (key.sequence === 'x' && !key.ctrl && !key.meta) {
                cancelSelected();
                return;
            }
            // Note: the "stop all agents" chord (ctrl+x ctrl+k in claw-code)
            // is intentionally deferred. `useKeypress` fires per keystroke,
            // so collapsing the chord to plain ctrl+k makes a destructive
            // action too easy to trigger by mistake. Stop-all will land in
            // a follow-up PR once proper chord handling is in place.
            return;
        }
        // detail mode
        if (key.name === 'left') {
            exitDetail();
            return;
        }
        if (key.name === 'escape' ||
            key.name === 'return' ||
            key.name === 'space') {
            closeDialog();
            return;
        }
        if (key.sequence === 'r' && !key.ctrl && !key.meta) {
            void resumeSelected();
            return;
        }
        if (key.sequence === 'x' && !key.ctrl && !key.meta) {
            cancelSelected();
            return;
        }
    }, { isActive: dialogOpen });
    if (!dialogOpen)
        return null;
    const selectedEntryAllowsResume = selectedEntry?.kind === 'agent' &&
        selectedEntry.status === 'paused' &&
        !selectedEntry.resumeBlockedReason;
    // Hint footer — context-sensitive.
    const hints = [];
    if (dialogMode === 'list') {
        hints.push('\u2191/\u2193 select', 'Enter view');
        if (selectedEntry?.status === 'running')
            hints.push('x stop');
        if (selectedEntryAllowsResume)
            hints.push('r resume');
        if (selectedEntry?.kind === 'agent' && selectedEntry.status === 'paused') {
            hints.push('x abandon');
        }
        hints.push('\u2190/Esc close');
    }
    else {
        hints.push('\u2190 go back', 'Esc/Enter/Space close');
        if (selectedEntry?.status === 'running')
            hints.push('x stop');
        if (selectedEntryAllowsResume)
            hints.push('r resume');
        if (selectedEntry?.kind === 'agent' && selectedEntry.status === 'paused') {
            hints.push('x abandon');
        }
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, marginTop: 1, paddingX: 1, children: [dialogMode === 'list' && (_jsx(Box, { paddingX: 1, children: _jsx(Text, { bold: true, color: theme.text.accent, children: "Background tasks" }) })), _jsx(Box, { marginTop: dialogMode === 'list' ? 1 : 0, children: dialogMode === 'list' ? (_jsx(ListBody, { entries: entries, selectedIndex: selectedIndex, maxRows: listMaxRows })) : selectedEntry ? (_jsx(DetailBody, { entry: selectedEntry, maxHeight: detailContentHeight, maxWidth: detailContentWidth })) : (_jsx(Box, { paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: "No entry to show." }) })) }), _jsx(Box, { marginTop: 1, paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: hints.join(' \u00B7 ') }) })] }));
};
//# sourceMappingURL=BackgroundTasksDialog.js.map