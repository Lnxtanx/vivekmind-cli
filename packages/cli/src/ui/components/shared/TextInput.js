import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
// no hooks needed beyond keypress handled inside
import { Box, Text } from 'ink';
import chalk from 'chalk';
import stringWidth from 'string-width';
import { useTextBuffer } from './text-buffer.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import { keyMatchers, Command } from '../../keyMatchers.js';
import { cpSlice, cpLen } from '../../utils/textUtils.js';
import { theme } from '../../semantic-colors.js';
import { Colors } from '../../colors.js';
import { useCallback, useRef, useEffect } from 'react';
export function TextInput({ value, onChange, onSubmit, onTab, onUp, onDown, placeholder, height = 1, isActive = true, validationErrors = [], inputWidth = 80, initialCursorOffset, }) {
    const allowMultiline = height > 1;
    // Stabilize onChange to avoid triggering useTextBuffer's onChange effect every render
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);
    const stableOnChange = useCallback((text) => {
        onChangeRef.current?.(text);
    }, []);
    const buffer = useTextBuffer({
        initialText: value || '',
        initialCursorOffset,
        viewport: { height, width: inputWidth },
        isValidPath: () => false,
        onChange: stableOnChange,
    });
    const handleSubmit = () => {
        if (!onSubmit)
            return;
        onSubmit();
    };
    useKeypress((key) => {
        if (!buffer || !isActive)
            return;
        // Tab completion: delegate to caller instead of inserting a tab character
        // During paste, let tab through as literal content (e.g. Excel tab-separated data)
        if (key.name === 'tab' && !key.paste) {
            onTab?.(key);
            return;
        }
        // Arrow-key completion navigation: delegate to caller
        if (key.name === 'up' && onUp) {
            onUp();
            return;
        }
        if (key.name === 'down' && onDown) {
            onDown();
            return;
        }
        // Multiline newline insertion (Shift+Enter etc.) — check before SUBMIT
        // so that modified-Return keys aren't swallowed by the submit branch.
        if (allowMultiline && keyMatchers[Command.NEWLINE](key)) {
            buffer.newline();
            return;
        }
        // Submit on Enter (plain Return). In single-line mode any Return
        // variant submits since there is no newline concept.
        if (keyMatchers[Command.SUBMIT](key) ||
            (!allowMultiline && key.name === 'return')) {
            handleSubmit();
            return;
        }
        // Navigation helpers
        if (keyMatchers[Command.HOME](key)) {
            buffer.move('home');
            return;
        }
        if (keyMatchers[Command.END](key)) {
            buffer.move('end');
            buffer.moveToOffset(cpLen(buffer.text));
            return;
        }
        if (keyMatchers[Command.CLEAR_INPUT](key)) {
            if (buffer.text.length > 0)
                buffer.setText('');
            return;
        }
        if (keyMatchers[Command.KILL_LINE_RIGHT](key)) {
            buffer.killLineRight();
            return;
        }
        if (keyMatchers[Command.KILL_LINE_LEFT](key)) {
            buffer.killLineLeft();
            return;
        }
        if (keyMatchers[Command.OPEN_EXTERNAL_EDITOR](key)) {
            buffer.openInExternalEditor();
            return;
        }
        buffer.handleInput(key);
    }, { isActive });
    if (!buffer)
        return null;
    const linesToRender = buffer.viewportVisualLines;
    const [cursorVisualRowAbsolute, cursorVisualColAbsolute] = buffer.visualCursor;
    const scrollVisualRow = buffer.visualScrollRow;
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: theme.text.accent, children: '> ' }), _jsx(Box, { flexGrow: 1, flexDirection: "column", children: buffer.text.length === 0 && placeholder ? (_jsxs(Text, { children: [chalk.inverse(placeholder.slice(0, 1)), _jsx(Text, { color: Colors.Gray, children: placeholder.slice(1) })] })) : (linesToRender.map((lineText, visualIdxInRenderedSet) => {
                            const cursorVisualRow = cursorVisualRowAbsolute - scrollVisualRow;
                            let display = cpSlice(lineText, 0, inputWidth);
                            const currentVisualWidth = stringWidth(display);
                            if (currentVisualWidth < inputWidth) {
                                display = display + ' '.repeat(inputWidth - currentVisualWidth);
                            }
                            if (visualIdxInRenderedSet === cursorVisualRow) {
                                const relativeVisualColForHighlight = cursorVisualColAbsolute;
                                if (relativeVisualColForHighlight >= 0) {
                                    if (relativeVisualColForHighlight < cpLen(display)) {
                                        const charToHighlight = cpSlice(display, relativeVisualColForHighlight, relativeVisualColForHighlight + 1) || ' ';
                                        const highlighted = chalk.inverse(charToHighlight);
                                        display =
                                            cpSlice(display, 0, relativeVisualColForHighlight) +
                                                highlighted +
                                                cpSlice(display, relativeVisualColForHighlight + 1);
                                    }
                                    else if (relativeVisualColForHighlight === cpLen(display) &&
                                        cpLen(display) === inputWidth) {
                                        display = display + chalk.inverse(' ');
                                    }
                                }
                            }
                            return (_jsx(Text, { children: display }, `line-${visualIdxInRenderedSet}`));
                        })) })] }), validationErrors.length > 0 && (_jsx(Box, { flexDirection: "column", children: validationErrors.map((error, index) => (_jsxs(Text, { color: theme.status.error, children: ["\u26A0 ", error] }, index))) }))] }));
}
//# sourceMappingURL=TextInput.js.map