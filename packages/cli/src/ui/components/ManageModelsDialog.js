import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box, Text } from 'ink';
import { useCallback, useEffect, useMemo, useState } from 'react';
import process from 'node:process';
import {} from '@vivekmind/core';
import { useSettings } from '../contexts/SettingsContext.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { TextInput } from './shared/TextInput.js';
import { fetchManageModelsCatalog, getEnabledModelIdsForSource, saveManageModelsSelection, } from '../manageModels/manageModels.js';
const MAX_VISIBLE_MODELS = 12;
const MANAGE_MODELS_TABS = [
    { source: 'openrouter', label: 'OpenRouter', enabled: true },
    { source: 'modelstudio', label: 'ModelStudio', enabled: false },
];
export function buildModelLabel(entry) {
    return entry.label;
}
export function applyCatalogFilters(params) {
    const { entries, query, selectedIds, filterMode } = params;
    const normalized = query.trim().toLowerCase();
    const rawTokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
    const quickFilterEnabled = rawTokens.some((token) => token === 'enabled' || token === 'is:enabled');
    const tokens = rawTokens.filter((token) => token !== 'enabled' && token !== 'is:enabled');
    const selectedSet = new Set(selectedIds);
    return entries.filter((entry) => {
        if ((filterMode === 'enabled' || quickFilterEnabled) &&
            !selectedSet.has(entry.id)) {
            return false;
        }
        if (filterMode === 'free' && !entry.badges.includes('free')) {
            return false;
        }
        if (filterMode === 'vision' && !entry.supportsVision) {
            return false;
        }
        if (tokens.length === 0) {
            return true;
        }
        const haystack = `${entry.searchText} ${entry.id}`.toLowerCase();
        return tokens.every((token) => haystack.includes(token));
    });
}
function getFilterLabel(filterMode) {
    switch (filterMode) {
        case 'enabled':
            return 'Enabled';
        case 'free':
            return 'Free';
        case 'vision':
            return 'Vision';
        case 'all':
        default:
            return 'All';
    }
}
function cycleFilter(current, direction) {
    const modes = ['all', 'enabled', 'free', 'vision'];
    const currentIndex = modes.indexOf(current);
    const nextIndex = direction === 'right'
        ? (currentIndex + 1) % modes.length
        : (currentIndex - 1 + modes.length) % modes.length;
    return modes[nextIndex] || 'all';
}
function formatContextWindowSize(value) {
    return typeof value === 'number' ? value.toLocaleString('en-US') : 'unknown';
}
export function getNextFocusMode(current, direction, hasList) {
    const order = hasList
        ? ['tabs', 'search', 'list']
        : ['tabs', 'search'];
    const currentIndex = order.indexOf(current);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = direction === 'forward'
        ? (safeIndex + 1) % order.length
        : (safeIndex - 1 + order.length) % order.length;
    return order[nextIndex] || 'tabs';
}
export function getNextEnabledTabSource(current, direction) {
    const currentIndex = MANAGE_MODELS_TABS.findIndex((tab) => tab.source === current);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    for (let offset = 1; offset <= MANAGE_MODELS_TABS.length; offset += 1) {
        const candidateIndex = direction === 'right'
            ? (safeIndex + offset) % MANAGE_MODELS_TABS.length
            : (safeIndex - offset + MANAGE_MODELS_TABS.length) %
                MANAGE_MODELS_TABS.length;
        const candidate = MANAGE_MODELS_TABS[candidateIndex];
        if (candidate?.enabled) {
            return candidate.source;
        }
    }
    return current;
}
export function ManageModelsDialog({ config, onClose, }) {
    const settings = useSettings();
    const [activeTabSource, setActiveTabSource] = useState('openrouter');
    const source = 'openrouter';
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);
    const [catalog, setCatalog] = useState(null);
    const [query, setQuery] = useState('');
    const [focusMode, setFocusMode] = useState('tabs');
    const [filterMode, setFilterMode] = useState('all');
    const [selectedIds, setSelectedIds] = useState([]);
    const [highlightedId, setHighlightedId] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const loadCatalog = useCallback(async () => {
        setStatus('loading');
        setError(null);
        setStatusMessage(null);
        try {
            const nextCatalog = await fetchManageModelsCatalog(source);
            const enabledIds = getEnabledModelIdsForSource(source, settings);
            setCatalog(nextCatalog);
            setSelectedIds(enabledIds);
            setHighlightedId(nextCatalog.entries[0]?.id || null);
            setStatus('ready');
        }
        catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : String(loadError));
            setStatus('error');
        }
    }, [settings, source]);
    useEffect(() => {
        void loadCatalog();
    }, [loadCatalog]);
    const filteredEntries = useMemo(() => applyCatalogFilters({
        entries: catalog?.entries || [],
        query,
        selectedIds,
        filterMode,
    }), [catalog?.entries, query, selectedIds, filterMode]);
    useEffect(() => {
        if (filteredEntries.length === 0) {
            setHighlightedId(null);
            if (focusMode === 'list') {
                setFocusMode('search');
            }
            return;
        }
        if (highlightedId &&
            filteredEntries.some((entry) => entry.id === highlightedId)) {
            return;
        }
        setHighlightedId(filteredEntries[0]?.id || null);
    }, [filteredEntries, focusMode, highlightedId]);
    const highlightedIndex = useMemo(() => {
        if (!highlightedId) {
            return 0;
        }
        const index = filteredEntries.findIndex((entry) => entry.id === highlightedId);
        return index >= 0 ? index : 0;
    }, [filteredEntries, highlightedId]);
    const highlightedEntry = useMemo(() => {
        if (!highlightedId) {
            return null;
        }
        return catalog?.entries.find((entry) => entry.id === highlightedId) || null;
    }, [catalog?.entries, highlightedId]);
    const visibleWindow = useMemo(() => {
        if (filteredEntries.length <= MAX_VISIBLE_MODELS) {
            return {
                start: 0,
                entries: filteredEntries,
            };
        }
        const centeredStart = Math.max(0, Math.min(highlightedIndex - Math.floor(MAX_VISIBLE_MODELS / 2), filteredEntries.length - MAX_VISIBLE_MODELS));
        return {
            start: centeredStart,
            entries: filteredEntries.slice(centeredStart, centeredStart + MAX_VISIBLE_MODELS),
        };
    }, [filteredEntries, highlightedIndex]);
    const moveHighlight = useCallback((direction) => {
        if (filteredEntries.length === 0) {
            return;
        }
        if (direction === 'up') {
            if (highlightedIndex <= 0) {
                setFocusMode('search');
                return;
            }
            setHighlightedId(filteredEntries[highlightedIndex - 1]?.id || null);
            return;
        }
        const nextIndex = Math.min(highlightedIndex + 1, filteredEntries.length - 1);
        setHighlightedId(filteredEntries[nextIndex]?.id || null);
    }, [filteredEntries, highlightedIndex]);
    const toggleHighlightedSelection = useCallback(() => {
        const currentEntry = filteredEntries[highlightedIndex];
        if (!currentEntry) {
            return;
        }
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(currentEntry.id)) {
                next.delete(currentEntry.id);
            }
            else {
                next.add(currentEntry.id);
            }
            return Array.from(next);
        });
    }, [filteredEntries, highlightedIndex]);
    const handleSave = useCallback(async () => {
        if (!catalog) {
            return;
        }
        const selectedEntries = catalog.entries.filter((entry) => selectedIds.includes(entry.id));
        if (selectedEntries.length === 0) {
            setError('Select at least one model to keep enabled.');
            return;
        }
        setStatus('saving');
        setError(null);
        setStatusMessage(null);
        try {
            const selectedModels = selectedEntries.map((entry) => entry.model);
            const result = await saveManageModelsSelection({
                source,
                selectedModels,
                settings: settings,
                config,
            });
            setSelectedIds(result.selectedIds);
            setStatus('ready');
            setStatusMessage(result.activeModelId
                ? `Saved ${result.selectedIds.length} enabled models · active model: ${result.activeModelId} · use /model to switch models`
                : `Saved ${result.selectedIds.length} enabled models · use /model to switch models`);
        }
        catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : String(saveError));
            setStatus('error');
        }
    }, [catalog, config, selectedIds, settings, source]);
    useKeypress((key) => {
        if (key.name === 'escape') {
            onClose();
            return;
        }
        if (key.ctrl && key.name === 'r' && status !== 'saving') {
            void loadCatalog();
            return;
        }
        if (status === 'saving') {
            return;
        }
        if (key.name === 'tab') {
            setFocusMode((current) => getNextFocusMode(current, key.shift ? 'backward' : 'forward', filteredEntries.length > 0));
            return;
        }
        if (focusMode === 'tabs') {
            if (key.name === 'left') {
                setActiveTabSource((current) => getNextEnabledTabSource(current, 'left'));
                return;
            }
            if (key.name === 'right') {
                setActiveTabSource((current) => getNextEnabledTabSource(current, 'right'));
                return;
            }
            if (key.name === 'down') {
                setFocusMode('search');
            }
            return;
        }
        if (focusMode === 'search') {
            if (key.name === 'left') {
                setFilterMode((current) => cycleFilter(current, 'left'));
                return;
            }
            if (key.name === 'right') {
                setFilterMode((current) => cycleFilter(current, 'right'));
                return;
            }
            if (key.name === 'up') {
                setFocusMode('tabs');
                return;
            }
            if (key.name === 'down' && filteredEntries.length > 0) {
                setFocusMode('list');
            }
            return;
        }
        if (focusMode === 'list') {
            if (key.name === 'up') {
                moveHighlight('up');
                return;
            }
            if (key.name === 'down') {
                moveHighlight('down');
                return;
            }
            if (key.name === 'space' || key.sequence === ' ') {
                toggleHighlightedSelection();
                return;
            }
            if (key.name === 'return') {
                void handleSave();
            }
        }
    }, { isActive: true });
    const terminalWidth = process.stdout.columns || 120;
    const searchInputWidth = Math.max(40, Math.min(100, terminalWidth - 16));
    const enabledSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const hiddenAboveCount = visibleWindow.start;
    const hiddenBelowCount = Math.max(0, filteredEntries.length -
        (visibleWindow.start + visibleWindow.entries.length));
    return (_jsxs(Box, { flexDirection: "column", width: "100%", children: [_jsx(Box, { width: "100%", children: _jsx(Text, { color: theme.border.default, wrap: "truncate", children: '─'.repeat(200) }) }), _jsx(Box, { flexDirection: "column", children: _jsxs(Box, { children: [_jsxs(Text, { color: theme.text.accent, bold: true, children: ["Manage Models:", ' '] }), MANAGE_MODELS_TABS.map((tab) => {
                            const isActive = activeTabSource === tab.source;
                            const isFocused = focusMode === 'tabs' && isActive;
                            return (_jsx(Box, { marginRight: 2, children: isActive ? (_jsx(Text, { bold: true, backgroundColor: isFocused ? theme.text.accent : theme.border.default, color: theme.background.primary, children: ` ${tab.label} ` })) : (_jsx(Text, { color: theme.text.secondary, children: ` ${tab.label}${tab.enabled ? '' : ' (soon)'} ` })) }, tab.source));
                        })] }) }), (status === 'loading' || status === 'saving') && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.text.secondary, children: status === 'loading'
                        ? 'Loading OpenRouter catalog…'
                        : 'Saving enabled models…' }) })), error && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.status.error, children: error }) })), statusMessage && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.status.success, children: statusMessage }) })), _jsx(Box, { borderStyle: "round", borderColor: focusMode === 'search' ? theme.text.accent : theme.border.default, paddingLeft: 1, paddingRight: 1, children: _jsx(TextInput, { value: query, onChange: setQuery, onTab: () => {
                        if (filteredEntries.length > 0) {
                            setFocusMode('list');
                        }
                    }, onDown: () => {
                        if (filteredEntries.length > 0) {
                            setFocusMode('list');
                        }
                    }, placeholder: "Search models\u2026 (type enabled to filter)", height: 1, isActive: status !== 'saving' && focusMode === 'search', inputWidth: searchInputWidth }) }), _jsxs(Box, { flexDirection: "row", gap: 2, children: [_jsxs(Box, { borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", paddingX: 1, paddingY: 0, width: "56%", children: [_jsxs(Text, { color: theme.text.secondary, children: [getFilterLabel(filterMode), " \u00B7 ", catalog?.entries.length || 0, " total \u00B7 ", filteredEntries.length, " shown \u00B7 ", selectedIds.length, " enabled"] }), filteredEntries.length === 0 ? (_jsx(Text, { color: theme.text.secondary, children: "No models match the current search and filter." })) : (_jsxs(Box, { flexDirection: "column", children: [hiddenAboveCount > 0 && (_jsxs(Text, { color: theme.text.secondary, children: ["\u2191 ", hiddenAboveCount, " more above"] })), visibleWindow.entries.map((entry, index) => {
                                        const absoluteIndex = visibleWindow.start + index;
                                        const isActive = focusMode === 'list' && absoluteIndex === highlightedIndex;
                                        const isEnabled = enabledSet.has(entry.id);
                                        const prefix = isActive ? '›' : ' ';
                                        const checkbox = isEnabled ? '[✓]' : '[ ]';
                                        const rowColor = isActive
                                            ? theme.status.success
                                            : isEnabled
                                                ? theme.text.accent
                                                : theme.text.primary;
                                        return (_jsxs(Text, { color: rowColor, wrap: "truncate-end", children: [prefix, " ", checkbox, " ", buildModelLabel(entry)] }, entry.id));
                                    }), hiddenBelowCount > 0 && (_jsxs(Text, { color: theme.text.secondary, children: ["\u2193 ", hiddenBelowCount, " more below"] }))] }))] }), _jsxs(Box, { borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", paddingX: 1, paddingY: 0, width: "44%", children: [_jsx(Text, { bold: true, children: "Details" }), highlightedEntry ? (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { children: highlightedEntry.label }), _jsxs(Text, { color: theme.text.secondary, children: ["Model ID: ", highlightedEntry.id] }), _jsxs(Text, { color: theme.text.secondary, children: ["Enabled: ", enabledSet.has(highlightedEntry.id) ? 'yes' : 'no'] }), _jsxs(Text, { color: theme.text.secondary, children: ["Vision: ", highlightedEntry.supportsVision ? 'yes' : 'no'] }), _jsxs(Text, { color: theme.text.secondary, children: ["Context:", ' ', formatContextWindowSize(highlightedEntry.contextWindowSize)] }), _jsxs(Text, { color: theme.text.secondary, children: ["Tags:", ' ', highlightedEntry.badges.length > 0
                                                ? highlightedEntry.badges.join(', ')
                                                : 'none'] })] })) : (_jsx(Text, { color: theme.text.secondary, children: "Move to the model list to inspect a model." }))] })] }), _jsx(Box, { children: _jsx(Text, { color: theme.text.secondary, children: "\u2190/\u2192 tab switch \u00B7 \u2193 enter list \u00B7 Space toggle \u00B7 Enter save \u00B7 Esc cancel" }) })] }));
}
//# sourceMappingURL=ManageModelsDialog.js.map