/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Extension } from '@vivekmind/core';
interface ExtensionListStepProps {
    extensions: Extension[];
    extensionsUpdateState: Map<string, string>;
    onExtensionSelect: (extensionIndex: number) => void;
}
export declare const ExtensionListStep: ({ extensions, extensionsUpdateState, onExtensionSelect, }: ExtensionListStepProps) => import("react/jsx-runtime").JSX.Element;
export {};
