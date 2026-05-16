/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fsPromises from 'fs/promises';
import path from 'path';
import { CommandKind, } from './types.js';
import { getProjectSummaryPrompt } from '@vivekmind/core';
import { t } from '../../i18n/index.js';
export const summaryCommand = {
    name: 'summary',
    get description() {
        return t('Generate a project summary and save it to .vivekmind/PROJECT_SUMMARY.md');
    },
    kind: CommandKind.BUILT_IN,
    supportedModes: ['interactive', 'non_interactive', 'acp'],
    action: async (context) => {
        const { config } = context.services;
        const { ui } = context;
        const executionMode = context.executionMode ?? 'interactive';
        const abortSignal = context.abortSignal;
        if (!config) {
            return {
                type: 'message',
                messageType: 'error',
                content: t('Config not loaded.'),
            };
        }
        const geminiClient = config.getGeminiClient();
        if (!geminiClient) {
            return {
                type: 'message',
                messageType: 'error',
                content: t('No chat client available to generate summary.'),
            };
        }
        // Check if already generating summary (interactive UI only)
        if (executionMode === 'interactive' && ui.pendingItem) {
            ui.addItem({
                type: 'error',
                text: t('Already generating summary, wait for previous request to complete'),
            }, Date.now());
            return {
                type: 'message',
                messageType: 'error',
                content: t('Already generating summary, wait for previous request to complete'),
            };
        }
        const getChatHistory = () => {
            const chat = geminiClient.getChat();
            return chat.getHistory();
        };
        const validateChatHistory = (history) => {
            if (history.length <= 2) {
                throw new Error(t('No conversation found to summarize.'));
            }
        };
        const generateSummaryMarkdown = async (history) => {
            // Build the conversation context for summary generation
            const conversationContext = history.map((message) => ({
                role: message.role,
                parts: message.parts,
            }));
            // Use generateContent with chat history as context
            const response = await geminiClient.generateContent([
                ...conversationContext,
                {
                    role: 'user',
                    parts: [
                        {
                            text: getProjectSummaryPrompt(),
                        },
                    ],
                },
            ], {}, abortSignal ?? new AbortController().signal, config.getModel());
            // Extract text from response
            const parts = response.candidates?.[0]?.content?.parts;
            const markdownSummary = parts
                ?.map((part) => part.text)
                .filter((text) => typeof text === 'string')
                .join('') || '';
            if (!markdownSummary) {
                throw new Error(t('Failed to generate summary - no text content received from LLM response'));
            }
            return markdownSummary;
        };
        const saveSummaryToDisk = async (markdownSummary) => {
            // Ensure .vivekmind directory exists
            const projectRoot = config.getProjectRoot();
            const qwenDir = path.join(projectRoot, '.vivekmind');
            try {
                await fsPromises.mkdir(qwenDir, { recursive: true });
            }
            catch (_err) {
                // Directory might already exist, ignore error
            }
            // Save the summary to PROJECT_SUMMARY.md
            const summaryPath = path.join(qwenDir, 'PROJECT_SUMMARY.md');
            const summaryContent = `${markdownSummary}

---

## Summary Metadata
**Update time**: ${new Date().toISOString()} 
`;
            await fsPromises.writeFile(summaryPath, summaryContent, 'utf8');
            return {
                filePathForDisplay: '.vivekmind/PROJECT_SUMMARY.md',
                fullPath: summaryPath,
            };
        };
        const emitInteractivePending = (stage) => {
            if (executionMode !== 'interactive') {
                return;
            }
            const pendingMessage = {
                type: 'summary',
                summary: {
                    isPending: true,
                    stage,
                },
            };
            ui.setPendingItem(pendingMessage);
        };
        const completeInteractive = (filePathForDisplay) => {
            if (executionMode !== 'interactive') {
                return;
            }
            ui.setPendingItem(null);
            const completedSummaryItem = {
                type: 'summary',
                summary: {
                    isPending: false,
                    stage: 'completed',
                    filePath: filePathForDisplay,
                },
            };
            ui.addItem(completedSummaryItem, Date.now());
        };
        const formatErrorMessage = (error) => t('Failed to generate project context summary: {{error}}', {
            error: error instanceof Error ? error.message : String(error),
        });
        const failInteractive = (error) => {
            if (executionMode !== 'interactive') {
                return;
            }
            // If cancelled via ESC, don't show error — cancelSlashCommand already handled UI
            if (abortSignal?.aborted) {
                return;
            }
            ui.setPendingItem(null);
            ui.addItem({
                type: 'error',
                text: `❌ ${formatErrorMessage(error)}`,
            }, Date.now());
        };
        const formatSuccessMessage = (filePathForDisplay) => t('Saved project summary to {{filePathForDisplay}}.', {
            filePathForDisplay,
        });
        const returnNoConversationMessage = () => {
            const msg = t('No conversation found to summarize.');
            if (executionMode === 'acp') {
                const messages = async function* () {
                    yield {
                        messageType: 'info',
                        content: msg,
                    };
                };
                return {
                    type: 'stream_messages',
                    messages: messages(),
                };
            }
            return {
                type: 'message',
                messageType: 'info',
                content: msg,
            };
        };
        const executeSummaryGeneration = async (history) => {
            emitInteractivePending('generating');
            const markdownSummary = await generateSummaryMarkdown(history);
            if (abortSignal?.aborted) {
                throw new DOMException('Summary generation cancelled.', 'AbortError');
            }
            emitInteractivePending('saving');
            const { filePathForDisplay } = await saveSummaryToDisk(markdownSummary);
            completeInteractive(filePathForDisplay);
            return { markdownSummary, filePathForDisplay };
        };
        // Validate chat history once at the beginning
        const history = getChatHistory();
        try {
            validateChatHistory(history);
        }
        catch (_error) {
            return returnNoConversationMessage();
        }
        if (executionMode === 'acp') {
            const messages = async function* () {
                try {
                    yield {
                        messageType: 'info',
                        content: t('Generating project summary...'),
                    };
                    const { filePathForDisplay } = await executeSummaryGeneration(history);
                    yield {
                        messageType: 'info',
                        content: formatSuccessMessage(filePathForDisplay),
                    };
                }
                catch (error) {
                    failInteractive(error);
                    yield {
                        messageType: 'error',
                        content: formatErrorMessage(error),
                    };
                }
            };
            return {
                type: 'stream_messages',
                messages: messages(),
            };
        }
        try {
            const { filePathForDisplay } = await executeSummaryGeneration(history);
            if (executionMode === 'non_interactive') {
                return {
                    type: 'message',
                    messageType: 'info',
                    content: formatSuccessMessage(filePathForDisplay),
                };
            }
            // Interactive mode: UI components already display progress and completion.
            return {
                type: 'message',
                messageType: 'info',
                content: '',
            };
        }
        catch (error) {
            failInteractive(error);
            return {
                type: 'message',
                messageType: 'error',
                content: formatErrorMessage(error),
            };
        }
    },
};
//# sourceMappingURL=summaryCommand.js.map