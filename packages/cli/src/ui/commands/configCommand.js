/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { exec } from 'child_process';
import { Storage } from '@vivekmind/core';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { t } from '../../i18n/index.js';
/**
 * /config command - opens the global settings.json file in the default editor.
 */
export const configCommand = {
    name: 'config',
    altNames: ['settings-file'],
    kind: CommandKind.BUILT_IN,
    supportedModes: ['interactive'],
    get description() {
        return t('Open the VivekMind settings.json file in your default editor');
    },
    action: async (context) => {
        const configPath = Storage.getGlobalSettingsPath();
        context.ui.addItem({
            type: MessageType.INFO,
            text: t('Opening configuration file: {{path}}', { path: configPath }),
        }, Date.now());
        const openCmd = process.platform === 'win32'
            ? `start "" "${configPath}"`
            : process.platform === 'darwin'
                ? `open "${configPath}"`
                : `xdg-open "${configPath}" || code "${configPath}"`;
        exec(openCmd, (error) => {
            if (error) {
                context.ui.addItem({
                    type: MessageType.ERROR,
                    text: t('Failed to open configuration file: {{message}}', { message: error.message }),
                }, Date.now());
            }
        });
    },
};
/**
 * /env command - displays current environment and configuration status.
 */
export const envCommand = {
    name: 'env',
    kind: CommandKind.BUILT_IN,
    supportedModes: ['interactive'],
    get description() {
        return t('Display current environment and configuration status');
    },
    action: async (context) => {
        const config = context.services.config;
        if (!config)
            return;
        const authType = config.getAuthType();
        const model = config.getModel();
        const configPath = Storage.getGlobalSettingsPath();
        let envStatus = `\n  ${t('Environment Configuration:')}\n\n`;
        envStatus += `  ${t('Provider')}:     ${authType || t('(none)')}\n`;
        envStatus += `  ${t('Model')}:        ${model || t('(none)')}\n`;
        envStatus += `  ${t('Config File')}:  ${configPath}\n`;
        context.ui.addItem({
            type: MessageType.INFO,
            text: envStatus,
        }, Date.now());
        context.ui.addItem({
            type: MessageType.INFO,
            text: t('Tip: Use /config to open and edit your configuration file.'),
        }, Date.now());
    },
};
//# sourceMappingURL=configCommand.js.map