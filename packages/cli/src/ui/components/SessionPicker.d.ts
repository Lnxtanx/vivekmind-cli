/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { SessionListItem as SessionData, SessionService } from '@vivekmind/core';
export interface SessionPickerProps {
    sessionService: SessionService | null;
    onSelect: (sessionId: string) => void;
    onCancel: () => void;
    currentBranch?: string;
    /**
     * Custom title for the picker header. Defaults to "Resume Session".
     */
    title?: string;
    /**
     * Scroll mode. When true, keep selection centered (fullscreen-style).
     * Defaults to true so dialog + standalone behave identically.
     */
    centerSelection?: boolean;
    /**
     * Pre-filtered sessions to display instead of loading all sessions.
     * When provided, skips initial load and disables pagination.
     */
    initialSessions?: SessionData[];
    /**
     * Enable Space-to-preview. Off by default — preview's Enter shortcut
     * forwards to `onSelect`, which for resume flows is "resume", but for
     * destructive flows (e.g. delete) would commit the action. Only opt in
     * for non-destructive selection flows.
     */
    enablePreview?: boolean;
}
export declare function SessionPicker(props: SessionPickerProps): import("react/jsx-runtime").JSX.Element;
