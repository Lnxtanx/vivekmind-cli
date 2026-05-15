/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandKind } from './types.js';
import { t } from '../../i18n/index.js';
export const authCommand = {
    name: 'auth',
    altNames: ['login'],
    get description() {
        return t('Configure authentication information for login');
    },
    kind: CommandKind.BUILT_IN,
    supportedModes: ['interactive'],
    action: (_context, _args) => ({
        type: 'dialog',
        dialog: 'auth',
    }),
};
//# sourceMappingURL=authCommand.js.map