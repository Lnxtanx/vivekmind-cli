/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { SessionListItem, SessionService } from '@vivekmind/core';
import { type SessionState } from '../utils/sessionPickerUtils.js';
export interface UseSessionPickerOptions {
    sessionService: SessionService | null;
    currentBranch?: string;
    onSelect: (sessionId: string) => void;
    onCancel: () => void;
    maxVisibleItems: number;
    /**
     * If true, computes centered scroll offset (keeps selection near middle).
     * If false, uses follow mode (scrolls when selection reaches edge).
     */
    centerSelection?: boolean;
    /**
     * Pre-filtered sessions to display instead of loading from sessionService.
     * When provided, skips the initial listSessions() call and disables
     * pagination (load-more). Used by /resume <title> when multiple sessions
     * match the given title.
     */
    initialSessions?: SessionListItem[];
    /**
     * Enable/disable input handling.
     */
    isActive?: boolean;
    /**
     * Enable Space-to-preview. See SessionPickerProps.enablePreview for the
     * safety rationale (preview's Enter forwards to onSelect).
     */
    enablePreview?: boolean;
}
export interface UseSessionPickerResult {
    selectedIndex: number;
    sessionState: SessionState;
    filteredSessions: SessionListItem[];
    filterByBranch: boolean;
    isLoading: boolean;
    scrollOffset: number;
    visibleSessions: SessionListItem[];
    showScrollUp: boolean;
    showScrollDown: boolean;
    loadMoreSessions: () => Promise<void>;
    viewMode: 'list' | 'preview';
    previewSessionId: string | null;
    exitPreview: () => void;
}
export declare function useSessionPicker({ sessionService, currentBranch, onSelect, onCancel, maxVisibleItems, centerSelection, initialSessions, isActive, enablePreview, }: UseSessionPickerOptions): UseSessionPickerResult;
