/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback } from 'react';
import { SettingScope } from '../../config/settings.js';
/**
 * Hook that handles closing dialogs when Ctrl+C is pressed.
 * This mimics the ESC key behavior by calling the same handlers that ESC uses.
 * Returns true if a dialog was closed, false if no dialogs were open.
 */
export function useDialogClose(options) {
    const closeAnyOpenDialog = useCallback(() => {
        // Check each dialog in priority order and close using the same logic as ESC key
        if (options.isThemeDialogOpen) {
            // Mimic ESC behavior: onSelect(undefined, selectedScope) - keeps current theme
            options.handleThemeSelect(undefined, SettingScope.User);
            return true;
        }
        if (options.isApprovalModeDialogOpen) {
            // Mimic ESC behavior: onSelect(undefined, selectedScope) - keeps current mode
            options.handleApprovalModeSelect(undefined, SettingScope.User);
            return true;
        }
        if (options.isEditorDialogOpen) {
            // Mimic ESC behavior: call onExit() directly
            options.exitEditorDialog();
            return true;
        }
        if (options.isSettingsDialogOpen) {
            // Mimic ESC behavior: onSelect(undefined, selectedScope)
            options.closeSettingsDialog();
            return true;
        }
        if (options.isMemoryDialogOpen) {
            options.closeMemoryDialog();
            return true;
        }
        if (options.activeArenaDialog !== null) {
            options.closeArenaDialog();
            return true;
        }
        if (options.isFolderTrustDialogOpen) {
            // FolderTrustDialog doesn't expose close function, but ESC would prevent exit
            // We follow the same pattern - prevent exit behavior
            return true;
        }
        if (options.showWelcomeBackDialog) {
            // WelcomeBack has its own close handler
            options.handleWelcomeBackClose();
            return true;
        }
        if (options.isBackgroundTasksDialogOpen) {
            // Background tasks dialog — routed through closeAnyOpenDialog so
            // Ctrl+C and the global escape path dismiss it without escalating
            // to exit prompts.
            options.closeBackgroundTasksDialog();
            return true;
        }
        // No dialog was open
        return false;
    }, [options]);
    return { closeAnyOpenDialog };
}
//# sourceMappingURL=useDialogClose.js.map