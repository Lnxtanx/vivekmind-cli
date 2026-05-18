/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandKind } from './types.js';
import { t } from '../../i18n/index.js';
export const manageModelsCommand = {
    name: 'manage-models',
    get description() {
        return t('Browse dynamic model catalogs and choose which models stay enabled locally');
    },
    kind: CommandKind.BUILT_IN,
    supportedModes: ['interactive'],
    action: () => ({
        type: 'dialog',
        dialog: 'manage-models',
    }),
};
//# sourceMappingURL=manageModelsCommand.js.map