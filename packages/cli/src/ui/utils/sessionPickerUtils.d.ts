/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { SessionListItem } from '@vivekmind/core';
/**
 * State for managing loaded sessions in the session picker.
 */
export interface SessionState {
    sessions: SessionListItem[];
    hasMore: boolean;
    nextCursor?: number;
}
/**
 * Page size for loading sessions.
 */
export declare const SESSION_PAGE_SIZE = 20;
/**
 * Truncates text to fit within a given width, adding ellipsis if needed.
 */
export declare function truncateText(text: string, maxWidth: number): string;
/**
 * Filters sessions optionally by branch.
 */
export declare function filterSessions(sessions: SessionListItem[], filterByBranch: boolean, currentBranch?: string): SessionListItem[];
/**
 * Formats message count for display with proper pluralization.
 */
export declare function formatMessageCount(count: number): string;
