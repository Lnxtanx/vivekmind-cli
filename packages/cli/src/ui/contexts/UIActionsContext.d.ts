/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Key } from '../hooks/useKeypress.js';
import { type IdeIntegrationNudgeResult } from '../IdeIntegrationNudge.js';
import { type CommandMigrationNudgeResult } from '../CommandFormatMigrationNudge.js';
import { type FolderTrustChoice } from '../components/FolderTrustDialog.js';
import { type AuthType, type EditorType, type ApprovalMode, type CodingPlanRegion } from '@vivekmind/core';
import { type SettingScope } from '../../config/settings.js';
import { type AlibabaStandardRegion } from '../../constants/alibabaStandardApiKey.js';
import type { AuthState, HistoryItem } from '../types.js';
import { type ArenaDialogType } from '../hooks/useArenaCommand.js';
export interface OpenAICredentials {
    apiKey: string;
    baseUrl?: string;
    model?: string;
}
export interface UIActions {
    openThemeDialog: () => void;
    openEditorDialog: () => void;
    openMemoryDialog: () => void;
    handleThemeSelect: (themeName: string | undefined, scope: SettingScope) => void;
    handleThemeHighlight: (themeName: string | undefined) => void;
    handleApprovalModeSelect: (mode: ApprovalMode | undefined, scope: SettingScope) => void;
    handleAuthSelect: (authType: AuthType | undefined, credentials?: OpenAICredentials) => Promise<void>;
    handleCodingPlanSubmit: (apiKey: string, region?: CodingPlanRegion) => Promise<void>;
    handleAlibabaStandardSubmit: (apiKey: string, region: AlibabaStandardRegion, modelIdsInput: string) => Promise<void>;
    handleOpenRouterSubmit: () => Promise<void>;
    handleCustomApiKeySubmit: (protocol: AuthType, baseUrl: string, apiKey: string, modelIdsInput: string, generationConfig?: {
        enableThinking?: boolean;
        multimodal?: {
            image?: boolean;
            video?: boolean;
            audio?: boolean;
        };
        maxTokens?: number;
    }) => Promise<void>;
    handleBedrockCredentialsSubmit: (accessKeyId: string, secretAccessKey: string, region: string, modelIdsInput: string) => Promise<void>;
    handleVertexCredentialsSubmit: (protocol: AuthType, projectId: string, location: string, modelIdsInput: string) => Promise<void>;
    setAuthState: (state: AuthState) => void;
    setPendingAuthType: (authType: AuthType | undefined) => void;
    onAuthError: (error: string | null) => void;
    cancelAuthentication: () => void;
    handleEditorSelect: (editorType: EditorType | undefined, scope: SettingScope) => void;
    exitEditorDialog: () => void;
    closeSettingsDialog: () => void;
    closeMemoryDialog: () => void;
    closeModelDialog: () => void;
    openModelDialog: (options?: {
        fastModelMode?: boolean;
    }) => void;
    openManageModelsDialog: () => void;
    closeManageModelsDialog: () => void;
    openArenaDialog: (type: Exclude<ArenaDialogType, null>) => void;
    closeArenaDialog: () => void;
    handleArenaModelsSelected?: (models: string[]) => void;
    dismissCodingPlanUpdate: () => void;
    closeTrustDialog: () => void;
    closePermissionsDialog: () => void;
    setShellModeActive: (value: boolean) => void;
    vimHandleInput: (key: Key) => boolean;
    handleIdePromptComplete: (result: IdeIntegrationNudgeResult) => void;
    handleCommandMigrationComplete: (result: CommandMigrationNudgeResult) => void;
    handleFolderTrustSelect: (choice: FolderTrustChoice) => void;
    setConstrainHeight: (value: boolean) => void;
    onEscapePromptChange: (show: boolean) => void;
    onSuggestionsVisibilityChange: (visible: boolean) => void;
    refreshStatic: () => void;
    handleFinalSubmit: (value: string) => void;
    handleRetryLastPrompt: () => void;
    handleClearScreen: () => void;
    popAllQueuedMessages: () => string | null;
    handleWelcomeBackSelection: (choice: 'continue' | 'restart') => void;
    handleWelcomeBackClose: () => void;
    closeSubagentCreateDialog: () => void;
    closeAgentsManagerDialog: () => void;
    closeExtensionsManagerDialog: () => void;
    closeMcpDialog: () => void;
    openHooksDialog: () => void;
    closeHooksDialog: () => void;
    openResumeDialog: () => void;
    closeResumeDialog: () => void;
    handleResume: (sessionId: string) => void;
    openDeleteDialog: () => void;
    closeDeleteDialog: () => void;
    handleDelete: (sessionId: string) => void;
    openFeedbackDialog: () => void;
    closeFeedbackDialog: () => void;
    temporaryCloseFeedbackDialog: () => void;
    submitFeedback: (rating: number) => void;
    openRewindSelector: () => void;
    closeRewindSelector: () => void;
    handleRewindConfirm: (userItem: HistoryItem) => void;
}
export declare const UIActionsContext: import("react").Context<UIActions | null>;
export declare const useUIActions: () => UIActions;
