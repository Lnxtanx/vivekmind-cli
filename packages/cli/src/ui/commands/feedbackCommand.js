/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandKind, } from './types.js';
import { MessageType } from '../types.js';
import { FeedbackService } from '../../services/FeedbackService.js';
import { t } from '../../i18n/index.js';
export const feedbackCommand = {
    name: 'feedback',
    altNames: ['suggest', 'idea'],
    get description() {
        return t('submit feedback or a feature suggestion');
    },
    kind: CommandKind.BUILT_IN,
    argumentHint: '<description>',
    supportedModes: ['interactive'],
    action: async (context, args) => {
        const feedbackContent = (args || '').trim();
        if (!feedbackContent) {
            return {
                type: 'message',
                messageType: 'info',
                content: t('Please provide your feedback. Usage: /feedback <your feedback here>'),
            };
        }
        context.ui.addItem({
            type: MessageType.INFO,
            text: t('Submitting your feedback...'),
        }, Date.now());
        const result = await FeedbackService.submitFeedback({
            type: 'general',
            content: feedbackContent,
            metadata: {
                command: 'feedback',
            }
        }, context.services.config || undefined);
        if (result.success) {
            return {
                type: 'message',
                messageType: 'info',
                content: t('✓ Thank you for your feedback! It has been submitted to the VivekMind team.'),
            };
        }
        else {
            return {
                type: 'message',
                messageType: 'error',
                content: t('✕ Failed to submit feedback: {{message}}', { message: result.message || t('Unknown error') }),
            };
        }
    },
};
//# sourceMappingURL=feedbackCommand.js.map