import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { CommandKind } from '../commands/types.js';
import { t } from '../../i18n/index.js';
export const Help = ({ commands, width }) => (_jsxs(Box, { flexDirection: "column", borderColor: theme.border.default, borderStyle: "round", padding: 1, width: width, children: [_jsx(Text, { bold: true, color: theme.text.primary, children: t('Basics:') }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: t('Add context') }), ":", ' ', t('Use {{symbol}} to specify files for context (e.g., {{example}}) to target specific files or folders.', {
                    symbol: t('@'),
                    example: t('@src/myFile.ts'),
                })] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: t('Shell mode') }), ":", ' ', t('Execute shell commands via {{symbol}} (e.g., {{example1}}) or use natural language (e.g., {{example2}}).', {
                    symbol: t('!'),
                    example1: t('!npm run start'),
                    example2: t('start server'),
                })] }), _jsx(Box, { height: 1 }), _jsx(Text, { bold: true, color: theme.text.primary, children: t('Commands:') }), commands
            .filter((command) => command.description && !command.hidden)
            .map((command) => (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: theme.text.primary, children: [_jsxs(Text, { bold: true, color: theme.text.accent, children: [' ', formatCommandLabel(command, '/')] }), command.kind === CommandKind.MCP_PROMPT && (_jsx(Text, { color: theme.text.secondary, children: " [MCP]" })), command.description && ' - ' + command.description] }), command.subCommands &&
                    command.subCommands
                        .filter((subCommand) => !subCommand.hidden)
                        .map((subCommand) => (_jsxs(Text, { color: theme.text.primary, children: [_jsxs(Text, { bold: true, color: theme.text.accent, children: ['   ', formatCommandLabel(subCommand)] }), subCommand.description && ' - ' + subCommand.description] }, subCommand.name)))] }, command.name))), _jsxs(Text, { color: theme.text.primary, children: [_jsxs(Text, { bold: true, color: theme.text.accent, children: [' ', "!", ' '] }), "- ", t('shell command')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { color: theme.text.secondary, children: "[MCP]" }), " -", ' ', t('Model Context Protocol command (from external servers)')] }), _jsx(Box, { height: 1 }), _jsx(Text, { bold: true, color: theme.text.primary, children: t('Keyboard Shortcuts:') }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: "Alt+Left/Right" }), ' ', "- ", t('Jump through words in the input')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: "Ctrl+C" }), ' ', "- ", t('Close dialogs, cancel requests, or quit application')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: process.platform === 'win32' ? 'Ctrl+Enter' : 'Ctrl+J' }), ' ', "-", ' ', process.platform === 'linux'
                    ? t('New line (Alt+Enter works for certain linux distros)')
                    : t('New line')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: "Ctrl+L" }), ' ', "- ", t('Clear the screen')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: "Ctrl+O" }), ' ', "- ", t('to toggle compact mode')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: process.platform === 'darwin' ? 'Ctrl+X / Meta+Enter' : 'Ctrl+X' }), ' ', "- ", t('Open input in external editor')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: "Enter" }), ' ', "- ", t('Send message')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: "Esc" }), ' ', "- ", t('Cancel operation / Clear input (double press)')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: process.platform === 'win32' ? 'Tab' : 'Shift+Tab' }), ' ', "- ", t('Cycle approval modes')] }), _jsxs(Text, { color: theme.text.primary, children: [_jsx(Text, { bold: true, color: theme.text.accent, children: "Up/Down" }), ' ', "- ", t('Cycle through your prompt history')] }), _jsx(Box, { height: 1 }), _jsx(Text, { color: theme.text.primary, children: t('For a full list of shortcuts, see {{docPath}}', {
                docPath: t('docs/keyboard-shortcuts.md'),
            }) })] }));
/**
 * Builds a display label for a slash command, including any alternate names.
 */
function formatCommandLabel(command, prefix = '') {
    const altNames = command.altNames?.filter(Boolean);
    const baseLabel = `${prefix}${command.name}`;
    if (!altNames || altNames.length === 0) {
        return baseLabel;
    }
    return `${baseLabel} (${altNames.join(', ')})`;
}
//# sourceMappingURL=Help.js.map