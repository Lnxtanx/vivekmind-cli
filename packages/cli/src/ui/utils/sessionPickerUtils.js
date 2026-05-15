/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Page size for loading sessions.
 */
export const SESSION_PAGE_SIZE = 20;
/**
 * Truncates text to fit within a given width, adding ellipsis if needed.
 */
export function truncateText(text, maxWidth) {
    const firstLine = text.split(/\r?\n/, 1)[0];
    if (firstLine.length <= maxWidth) {
        return firstLine;
    }
    if (maxWidth <= 3) {
        return firstLine.slice(0, maxWidth);
    }
    return firstLine.slice(0, maxWidth - 3) + '...';
}
/**
 * Filters sessions optionally by branch.
 */
export function filterSessions(sessions, filterByBranch, currentBranch) {
    return sessions.filter((session) => {
        // Apply branch filter if enabled
        if (filterByBranch && currentBranch) {
            return session.gitBranch === currentBranch;
        }
        return true;
    });
}
/**
 * Formats message count for display with proper pluralization.
 */
export function formatMessageCount(count) {
    return count === 1 ? '1 message' : `${count} messages`;
}
//# sourceMappingURL=sessionPickerUtils.js.map