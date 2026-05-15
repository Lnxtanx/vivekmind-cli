/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Extension } from '@vivekmind/core';
interface UninstallConfirmStepProps {
    selectedExtension: Extension | null;
    onConfirm: (extension: Extension) => Promise<void>;
    onNavigateBack: () => void;
}
export declare function UninstallConfirmStep({ selectedExtension, onConfirm, onNavigateBack, }: UninstallConfirmStepProps): import("react/jsx-runtime").JSX.Element;
export {};
