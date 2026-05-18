/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { HistoryItem } from '../types.js';
export interface RewindSelectorProps {
    history: HistoryItem[];
    onRewind: (userItem: HistoryItem) => void;
    onCancel: () => void;
}
/**
 * Two-phase rewind selector:
 * 1. Pick list — choose which user turn to rewind to
 * 2. Confirm — confirm the rewind action
 */
export declare function RewindSelector({ history, onRewind, onCancel, }: RewindSelectorProps): import("react/jsx-runtime").JSX.Element;
