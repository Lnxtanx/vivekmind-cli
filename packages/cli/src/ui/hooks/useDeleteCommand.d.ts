/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '@vivekmind/core';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
export interface UseDeleteCommandOptions {
    config: Config | null;
    addItem: UseHistoryManagerReturn['addItem'];
}
export interface UseDeleteCommandResult {
    isDeleteDialogOpen: boolean;
    openDeleteDialog: () => void;
    closeDeleteDialog: () => void;
    handleDelete: (sessionId: string) => void;
}
export declare function useDeleteCommand(options?: UseDeleteCommandOptions): UseDeleteCommandResult;
