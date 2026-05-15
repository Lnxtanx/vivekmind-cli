import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { shortenPath, tildeifyPath } from '@vivekmind/core';
import { theme } from '../semantic-colors.js';
import { shortAsciiLogo } from './AsciiArt.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
export const Header = ({ customAsciiArt, version, authDisplayType, model, workingDirectory, }) => {
    const { columns: terminalWidth } = useTerminalSize();
    const displayLogo = customAsciiArt ?? shortAsciiLogo;
    const formattedAuthType = authDisplayType ?? '—';
    const tildeifiedPath = tildeifyPath(workingDirectory);
    const displayPath = shortenPath(tildeifiedPath, Math.max(10, terminalWidth - 20));
    return (_jsxs(Box, { flexDirection: "column", width: "100%", marginTop: 1, marginBottom: 1, children: [_jsx(Box, { justifyContent: "center", children: _jsx(Text, { bold: true, color: "#E53E3E", children: displayLogo }) }), _jsx(Box, { justifyContent: "center", marginTop: -1, marginBottom: 1, children: _jsx(Text, { color: theme.text.secondary, children: "Your Universal AI Coding Agent \u2014 Any Provider, Your Keys" }) }), _jsxs(Box, { flexDirection: "column", paddingLeft: 3, children: [_jsxs(Box, { children: [_jsx(Box, { width: 12, children: _jsx(Text, { color: theme.text.secondary, children: "Version" }) }), _jsx(Text, { color: "white", children: "1.0.0" })] }), _jsxs(Box, { children: [_jsx(Box, { width: 12, children: _jsx(Text, { color: theme.text.secondary, children: "Model" }) }), _jsx(Text, { color: "cyan", children: model }), _jsx(Text, { color: theme.text.secondary, children: " (/model to change)" })] }), _jsxs(Box, { children: [_jsx(Box, { width: 12, children: _jsx(Text, { color: theme.text.secondary, children: "Provider" }) }), _jsx(Text, { color: "white", children: formattedAuthType })] }), _jsxs(Box, { children: [_jsx(Box, { width: 12, children: _jsx(Text, { color: theme.text.secondary, children: "Workspace" }) }), _jsx(Text, { color: "white", children: displayPath })] })] })] }));
};
//# sourceMappingURL=Header.js.map