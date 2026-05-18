/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { getExtendedSystemInfo } from '../../utils/systemInfo.js';
import { t } from '../../i18n/index.js';
export const aboutCommand = {
    name: 'status',
    altNames: ['about'],
    get description() {
        return t('show version info');
    },
    kind: CommandKind.BUILT_IN,
    supportedModes: ['interactive', 'non_interactive', 'acp'],
    action: async (context) => {
        const systemInfo = await getExtendedSystemInfo(context);
        if (context.executionMode !== 'interactive') {
            const lines = [
                `VivekMind v${systemInfo.cliVersion}`,
                `Model: ${systemInfo.modelVersion}`,
                `Fast Model: ${systemInfo.fastModel ?? 'not set'}`,
                `Auth: ${systemInfo.selectedAuthType}`,
                `Platform: ${systemInfo.osPlatform} ${systemInfo.osArch} (${systemInfo.osRelease})`,
                `Node.js: ${systemInfo.nodeVersion}`,
                `Session: ${systemInfo.sessionId}`,
                ...(systemInfo.gitCommit
                    ? [`Git commit: ${systemInfo.gitCommit}`]
                    : []),
                ...(systemInfo.ideClient ? [`IDE: ${systemInfo.ideClient}`] : []),
            ];
            return {
                type: 'message',
                messageType: 'info',
                content: lines.join('\n'),
            };
        }
        const aboutItem = {
            type: MessageType.ABOUT,
            systemInfo,
        };
        context.ui.addItem(aboutItem, Date.now());
        return;
    },
};
//# sourceMappingURL=aboutCommand.js.map