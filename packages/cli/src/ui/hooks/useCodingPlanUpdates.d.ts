/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '@vivekmind/core';
import type { LoadedSettings } from '../../config/settings.js';
export interface CodingPlanUpdateRequest {
    prompt: string;
    onConfirm: (confirmed: boolean) => void;
}
/**
 * Hook for detecting and handling Coding Plan template updates.
 * Compares the persisted version with the current template version
 * and prompts the user to update if they differ.
 */
export declare function useCodingPlanUpdates(settings: LoadedSettings, config: Config, addItem: (item: {
    type: 'info' | 'error' | 'warning';
    text: string;
}, timestamp: number) => void): {
    codingPlanUpdateRequest: CodingPlanUpdateRequest | undefined;
    dismissCodingPlanUpdate: () => void;
};
