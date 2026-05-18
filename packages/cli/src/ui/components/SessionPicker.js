import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useSessionPicker } from '../hooks/useSessionPicker.js';
import { formatRelativeTime } from '../utils/formatters.js';
import { formatMessageCount, truncateText, } from '../utils/sessionPickerUtils.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { t } from '../../i18n/index.js';
import { SessionPreview } from './SessionPreview.js';
const PREFIX_CHARS = {
    selected: '› ',
    scrollUp: '↑ ',
    scrollDown: '↓ ',
    normal: '  ',
};
function SessionListItemView({ session, isSelected, isFirst, isLast, showScrollUp, showScrollDown, maxPromptWidth, prefixChars = PREFIX_CHARS, boldSelectedPrefix = true, }) {
    const timeAgo = formatRelativeTime(session.mtime);
    const messageText = formatMessageCount(session.messageCount);
    const showUpIndicator = isFirst && showScrollUp;
    const showDownIndicator = isLast && showScrollDown;
    const prefix = isSelected
        ? prefixChars.selected
        : showUpIndicator
            ? prefixChars.scrollUp
            : showDownIndicator
                ? prefixChars.scrollDown
                : prefixChars.normal;
    const promptText = session.customTitle || session.prompt || '(empty prompt)';
    const truncatedPrompt = truncateText(promptText, maxPromptWidth);
    // Dim auto-generated titles so users can distinguish a model guess from
    // a title they chose themselves with `/rename`. Selected row keeps the
    // accent color — legibility of the focused row wins over source hinting.
    const isAutoTitle = session.titleSource === 'auto' && Boolean(session.customTitle);
    return (_jsxs(Box, { flexDirection: "column", marginBottom: isLast ? 0 : 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: isSelected
                            ? theme.text.accent
                            : showUpIndicator || showDownIndicator
                                ? theme.text.secondary
                                : undefined, bold: isSelected && boldSelectedPrefix, children: prefix }), _jsx(Text, { color: isSelected
                            ? theme.text.accent
                            : isAutoTitle
                                ? theme.text.secondary
                                : theme.text.primary, bold: isSelected, children: truncatedPrompt })] }), _jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: theme.text.secondary, children: [timeAgo, " \u00B7 ", messageText, session.gitBranch && ` · ${session.gitBranch}`] }) })] }));
}
export function SessionPicker(props) {
    const { sessionService, onSelect, onCancel, currentBranch, title, centerSelection = true, initialSessions, enablePreview = false, } = props;
    const { columns: width, rows: height } = useTerminalSize();
    // Calculate box width (marginX={2})
    const boxWidth = width - 4;
    // Calculate visible items (same heuristic as before)
    // Reserved space: header (1), footer (1), separators (2), borders (2)
    const reservedLines = 6;
    // Each item takes 2 lines (prompt + metadata) + 1 line margin between items
    const itemHeight = 3;
    const maxVisibleItems = Math.max(1, Math.floor((height - reservedLines) / itemHeight));
    const picker = useSessionPicker({
        sessionService,
        currentBranch,
        onSelect,
        onCancel,
        maxVisibleItems,
        centerSelection,
        initialSessions,
        isActive: true,
        enablePreview,
    });
    if (enablePreview &&
        picker.viewMode === 'preview' &&
        picker.previewSessionId &&
        sessionService) {
        const previewed = picker.filteredSessions.find((s) => s.sessionId === picker.previewSessionId);
        return (_jsx(SessionPreview, { sessionService: sessionService, sessionId: picker.previewSessionId, sessionTitle: previewed?.customTitle ?? previewed?.prompt ?? undefined, messageCount: previewed?.messageCount, mtime: previewed?.mtime, gitBranch: previewed?.gitBranch, onExit: picker.exitPreview, onResume: onSelect }));
    }
    return (_jsx(Box, { flexDirection: "column", width: boxWidth, height: height - 1, overflow: "hidden", children: _jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth, height: height - 1, overflow: "hidden", children: [_jsxs(Box, { paddingX: 1, children: [_jsx(Text, { bold: true, color: theme.text.primary, children: title ?? t('Resume Session') }), picker.filterByBranch && currentBranch && (_jsxs(Text, { color: theme.text.secondary, children: [' ', t('(branch: {{branch}})', { branch: currentBranch })] }))] }), _jsx(Box, { children: _jsx(Text, { color: theme.border.default, children: '─'.repeat(boxWidth - 2) }) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1, overflow: "hidden", children: !sessionService || picker.isLoading ? (_jsx(Box, { paddingY: 1, justifyContent: "center", children: _jsx(Text, { color: theme.text.secondary, children: t('Loading sessions...') }) })) : picker.filteredSessions.length === 0 ? (_jsx(Box, { paddingY: 1, justifyContent: "center", children: _jsx(Text, { color: theme.text.secondary, children: picker.filterByBranch
                                ? t('No sessions found for branch "{{branch}}"', {
                                    branch: currentBranch ?? '',
                                })
                                : t('No sessions found') }) })) : (picker.visibleSessions.map((session, visibleIndex) => {
                        const actualIndex = picker.scrollOffset + visibleIndex;
                        return (_jsx(SessionListItemView, { session: session, isSelected: actualIndex === picker.selectedIndex, isFirst: visibleIndex === 0, isLast: visibleIndex === picker.visibleSessions.length - 1, showScrollUp: picker.showScrollUp, showScrollDown: picker.showScrollDown, maxPromptWidth: boxWidth - 6, prefixChars: PREFIX_CHARS, boldSelectedPrefix: false }, session.sessionId));
                    })) }), _jsx(Box, { children: _jsx(Text, { color: theme.border.default, children: '─'.repeat(boxWidth - 2) }) }), _jsx(Box, { paddingX: 1, children: _jsxs(Box, { flexDirection: "row", children: [currentBranch && (_jsxs(Text, { color: theme.text.secondary, children: [_jsx(Text, { bold: picker.filterByBranch, color: picker.filterByBranch ? theme.text.accent : undefined, children: "B" }), t(' to toggle branch · ')] })), enablePreview && (_jsx(Text, { color: theme.text.secondary, children: t('Space to preview · ') })), _jsx(Text, { color: theme.text.secondary, children: t('↑↓ to navigate · Esc to cancel') })] }) })] }) }));
}
//# sourceMappingURL=SessionPicker.js.map