import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useMemo, useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { truncateText } from '../utils/sessionPickerUtils.js';
import { isRealUserTurn } from '../utils/historyMapping.js';
import { t } from '../../i18n/index.js';
const MAX_VISIBLE_ITEMS = 7;
/**
 * Extract user-type items from UI history for the rewind pick list.
 */
function getUserTurns(history) {
    return history.filter(isRealUserTurn);
}
function TurnItemView({ item, isSelected, isFirst, isLast, showScrollUp, showScrollDown, maxPromptWidth, turnNumber, }) {
    const showUpIndicator = isFirst && showScrollUp;
    const showDownIndicator = isLast && showScrollDown;
    const prefix = isSelected
        ? '› '
        : showUpIndicator
            ? '↑ '
            : showDownIndicator
                ? '↓ '
                : '  ';
    const promptText = item.text || '(empty prompt)';
    const truncatedPrompt = truncateText(promptText, maxPromptWidth);
    return (_jsx(Box, { flexDirection: "column", marginBottom: isLast ? 0 : 1, children: _jsxs(Box, { children: [_jsx(Text, { color: isSelected
                        ? theme.text.accent
                        : showUpIndicator || showDownIndicator
                            ? theme.text.secondary
                            : undefined, bold: isSelected, children: prefix }), _jsx(Text, { color: theme.text.secondary, children: `#${turnNumber} ` }), _jsx(Text, { color: isSelected ? theme.text.accent : theme.text.primary, bold: isSelected, children: truncatedPrompt })] }) }));
}
/**
 * Two-phase rewind selector:
 * 1. Pick list — choose which user turn to rewind to
 * 2. Confirm — confirm the rewind action
 */
export function RewindSelector({ history, onRewind, onCancel, }) {
    const { columns: width, rows: height } = useTerminalSize();
    const userTurns = useMemo(() => getUserTurns(history), [history]);
    const [selectedIndex, setSelectedIndex] = useState(userTurns.length - 1);
    const [confirmItem, setConfirmItem] = useState(null);
    const boxWidth = width - 4;
    const maxVisibleItems = Math.min(MAX_VISIBLE_ITEMS, userTurns.length);
    // Centered scroll offset
    const scrollOffset = useMemo(() => {
        if (userTurns.length <= maxVisibleItems)
            return 0;
        const halfVisible = Math.floor(maxVisibleItems / 2);
        let offset = selectedIndex - halfVisible;
        offset = Math.max(0, offset);
        offset = Math.min(userTurns.length - maxVisibleItems, offset);
        return offset;
    }, [userTurns.length, maxVisibleItems, selectedIndex]);
    const visibleTurns = useMemo(() => userTurns.slice(scrollOffset, scrollOffset + maxVisibleItems), [userTurns, scrollOffset, maxVisibleItems]);
    const showScrollUp = scrollOffset > 0;
    const showScrollDown = scrollOffset + maxVisibleItems < userTurns.length;
    const handleConfirmSelect = useCallback((confirmed) => {
        if (confirmed && confirmItem) {
            onRewind(confirmItem);
        }
        else {
            setConfirmItem(null);
        }
    }, [confirmItem, onRewind]);
    // Pick-list key handler
    useKeypress((key) => {
        const { name, ctrl } = key;
        if (name === 'escape' || (ctrl && name === 'c')) {
            onCancel();
            return;
        }
        if (name === 'return') {
            const selected = userTurns[selectedIndex];
            if (selected) {
                setConfirmItem(selected);
            }
            return;
        }
        if (name === 'up' || name === 'k') {
            setSelectedIndex((prev) => Math.max(0, prev - 1));
            return;
        }
        if (name === 'down' || name === 'j') {
            setSelectedIndex((prev) => Math.min(userTurns.length - 1, prev + 1));
            return;
        }
    }, { isActive: confirmItem === null });
    // Confirm key handler
    useKeypress((key) => {
        const { name, ctrl, sequence } = key;
        if (name === 'escape' || (ctrl && name === 'c')) {
            setConfirmItem(null);
            return;
        }
        if (name === 'return' || sequence === 'y' || sequence === 'Y') {
            handleConfirmSelect(true);
            return;
        }
        if (sequence === 'n' || sequence === 'N') {
            handleConfirmSelect(false);
            return;
        }
    }, { isActive: confirmItem !== null });
    if (userTurns.length === 0) {
        return (_jsx(Box, { flexDirection: "column", width: boxWidth, children: _jsx(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth, children: _jsx(Box, { paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: t('No user turns to rewind to.') }) }) }) }));
    }
    // Confirm phase
    if (confirmItem) {
        const promptPreview = truncateText(confirmItem.text || '(empty)', boxWidth - 10);
        return (_jsx(Box, { flexDirection: "column", width: boxWidth, children: _jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth, children: [_jsx(Box, { paddingX: 1, children: _jsx(Text, { bold: true, color: theme.text.primary, children: t('Rewind Conversation') }) }), _jsx(Box, { children: _jsx(Text, { color: theme.border.default, children: '─'.repeat(boxWidth - 2) }) }), _jsxs(Box, { paddingX: 1, flexDirection: "column", children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: theme.text.primary, children: t('Rewind to: ') }), _jsx(Text, { color: theme.text.accent, bold: true, children: promptPreview })] }), _jsx(Text, { color: theme.status.warning, children: t('This will remove all conversation after this turn. The prompt will be pre-populated in the input for editing.') })] }), _jsx(Box, { children: _jsx(Text, { color: theme.border.default, children: '─'.repeat(boxWidth - 2) }) }), _jsx(Box, { paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: t('Enter/Y to confirm · Esc/N to go back') }) })] }) }));
    }
    // Pick-list phase
    return (_jsx(Box, { flexDirection: "column", width: boxWidth, height: height - 1, overflow: "hidden", children: _jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth, height: height - 1, overflow: "hidden", children: [_jsxs(Box, { paddingX: 1, children: [_jsx(Text, { bold: true, color: theme.text.primary, children: t('Rewind Conversation') }), _jsxs(Text, { color: theme.text.secondary, children: [' ', t('({{count}} turns)', { count: String(userTurns.length) })] })] }), _jsx(Box, { children: _jsx(Text, { color: theme.border.default, children: '─'.repeat(boxWidth - 2) }) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1, overflow: "hidden", children: visibleTurns.map((item, visibleIndex) => {
                        const actualIndex = scrollOffset + visibleIndex;
                        return (_jsx(TurnItemView, { item: item, isSelected: actualIndex === selectedIndex, isFirst: visibleIndex === 0, isLast: visibleIndex === visibleTurns.length - 1, showScrollUp: showScrollUp, showScrollDown: showScrollDown, maxPromptWidth: boxWidth - 10, turnNumber: actualIndex + 1 }, item.id));
                    }) }), _jsx(Box, { children: _jsx(Text, { color: theme.border.default, children: '─'.repeat(boxWidth - 2) }) }), _jsx(Box, { paddingX: 1, children: _jsx(Text, { color: theme.text.secondary, children: t('↑↓ to navigate · Enter to select · Esc to cancel') }) })] }) }));
}
//# sourceMappingURL=RewindSelector.js.map