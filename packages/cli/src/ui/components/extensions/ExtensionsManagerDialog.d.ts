/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '@vivekmind/core';
interface ExtensionsManagerDialogProps {
    onClose: () => void;
    config: Config | null;
}
export declare function ExtensionsManagerDialog({ onClose, config, }: ExtensionsManagerDialogProps): import("react/jsx-runtime").JSX.Element;
export {};
