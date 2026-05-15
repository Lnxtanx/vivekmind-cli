/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback } from 'react';
import { SessionService, SessionStartSource, } from '@vivekmind/core';
import { buildResumedHistoryItems } from '../utils/resumeHistoryUtils.js';
import { MessageType } from '../types.js';
import { hasBlockingBackgroundWork, resetBackgroundStateForSessionSwitch, } from '../utils/backgroundWorkUtils.js';
const BACKGROUND_WORK_SWITCH_BLOCKED_MESSAGE = "Stop the current session's running background tasks before resuming another session.";
export function useResumeCommand(options) {
    const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false);
    const [resumeMatchedSessions, setResumeMatchedSessions] = useState();
    const openResumeDialog = useCallback((matchedSessions) => {
        setResumeMatchedSessions(matchedSessions);
        setIsResumeDialogOpen(true);
    }, []);
    const closeResumeDialog = useCallback(() => {
        setIsResumeDialogOpen(false);
        setResumeMatchedSessions(undefined);
    }, []);
    const { config, historyManager, startNewSession, setSessionName, remount } = options ?? {};
    const hasHistoryManager = !!historyManager;
    const { addItem, clearItems, loadHistory } = historyManager || {};
    const handleResume = useCallback(async (sessionId) => {
        if (!config || !hasHistoryManager || !startNewSession) {
            return;
        }
        if (hasBlockingBackgroundWork(config)) {
            closeResumeDialog();
            addItem?.({
                type: MessageType.ERROR,
                text: BACKGROUND_WORK_SWITCH_BLOCKED_MESSAGE,
            }, Date.now());
            return;
        }
        // Close dialog immediately to prevent input capture during async operations.
        closeResumeDialog();
        const cwd = config.getTargetDir();
        const sessionService = new SessionService(cwd);
        const sessionData = await sessionService.loadSession(sessionId);
        if (!sessionData) {
            return;
        }
        // Start new session in UI context.
        startNewSession(sessionId);
        // Restore session name tag from custom title.
        const customTitle = sessionService.getSessionTitle(sessionId);
        setSessionName?.(customTitle ?? null);
        // Reset UI history.
        const uiHistoryItems = buildResumedHistoryItems(sessionData, config);
        clearItems?.();
        loadHistory?.(uiHistoryItems);
        // Update session history core.
        resetBackgroundStateForSessionSwitch(config);
        config.startNewSession(sessionId, sessionData);
        // Rebuild turn boundary tracking so rewind works within resumed sessions.
        config
            .getChatRecordingService()
            ?.rebuildTurnBoundaries(sessionData.conversation.messages);
        await config.getGeminiClient()?.initialize?.();
        const recovered = await config.loadPausedBackgroundAgents(sessionId);
        if (recovered.length > 0) {
            addItem?.({
                type: MessageType.INFO,
                text: config
                    .getBackgroundAgentResumeService()
                    .buildRecoveredBackgroundAgentsNotice(recovered.length),
            }, Date.now());
        }
        // Fire SessionStart event after resuming session
        try {
            await config
                .getHookSystem()
                ?.fireSessionStartEvent(SessionStartSource.Resume, config.getModel() ?? '', String(config.getApprovalMode()));
        }
        catch (err) {
            config.getDebugLogger().warn(`SessionStart hook failed: ${err}`);
        }
        // Refresh terminal UI.
        remount?.();
    }, [
        closeResumeDialog,
        config,
        hasHistoryManager,
        addItem,
        clearItems,
        loadHistory,
        startNewSession,
        setSessionName,
        remount,
    ]);
    return {
        isResumeDialogOpen,
        resumeMatchedSessions,
        openResumeDialog,
        closeResumeDialog,
        handleResume,
    };
}
export { BACKGROUND_WORK_SWITCH_BLOCKED_MESSAGE };
//# sourceMappingURL=useResumeCommand.js.map