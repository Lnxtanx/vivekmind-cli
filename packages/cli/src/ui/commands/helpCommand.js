/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { t } from '../../i18n/index.js';
export const helpCommand = {
    name: 'help',
    altNames: ['?'],
    kind: CommandKind.BUILT_IN,
    supportedModes: ['interactive'],
    get description() {
        return t('for help on VivekMind');
    },
    action: async (context) => {
        const helpItem = {
            type: MessageType.HELP,
            timestamp: new Date(),
        };
        context.ui.addItem(helpItem, Date.now());
    },
};
//# sourceMappingURL=helpCommand.js.map