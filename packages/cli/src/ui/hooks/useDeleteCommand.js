/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback } from 'react';
import { t } from '../../i18n/index.js';
export function useDeleteCommand(options) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const openDeleteDialog = useCallback(() => {
        setIsDeleteDialogOpen(true);
    }, []);
    const closeDeleteDialog = useCallback(() => {
        setIsDeleteDialogOpen(false);
    }, []);
    const { config, addItem } = options ?? {};
    const handleDelete = useCallback(async (sessionId) => {
        if (!config) {
            return;
        }
        // Close dialog immediately.
        closeDeleteDialog();
        // Prevent deleting the current session.
        if (sessionId === config.getSessionId()) {
            addItem?.({
                type: 'info',
                text: t('Cannot delete the current active session.'),
            }, Date.now());
            return;
        }
        try {
            const sessionService = config.getSessionService();
            const success = await sessionService.removeSession(sessionId);
            if (success) {
                addItem?.({
                    type: 'info',
                    text: t('Session deleted successfully.'),
                }, Date.now());
            }
            else {
                addItem?.({
                    type: 'error',
                    text: t('Failed to delete session. Session not found.'),
                }, Date.now());
            }
        }
        catch {
            addItem?.({
                type: 'error',
                text: t('Failed to delete session.'),
            }, Date.now());
        }
    }, [closeDeleteDialog, config, addItem]);
    return {
        isDeleteDialogOpen,
        openDeleteDialog,
        closeDeleteDialog,
        handleDelete,
    };
}
//# sourceMappingURL=useDeleteCommand.js.map