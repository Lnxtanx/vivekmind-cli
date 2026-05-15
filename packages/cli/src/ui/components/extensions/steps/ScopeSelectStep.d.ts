/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Extension } from '@vivekmind/core';
interface ScopeSelectStepProps {
    selectedExtension: Extension | null;
    mode: 'disable' | 'enable';
    onScopeSelect: (scope: 'user' | 'workspace') => void;
}
export declare function ScopeSelectStep({ selectedExtension, mode, onScopeSelect, }: ScopeSelectStepProps): import("react/jsx-runtime").JSX.Element;
export {};
