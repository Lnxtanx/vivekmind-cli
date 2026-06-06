/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
interface UseExtensionsManagerDialogReturn {
    isExtensionsManagerDialogOpen: boolean;
    openExtensionsManagerDialog: () => void;
    closeExtensionsManagerDialog: () => void;
}
export declare const useExtensionsManagerDialog: () => UseExtensionsManagerDialogReturn;
export {};
