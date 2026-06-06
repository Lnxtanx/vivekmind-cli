/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '@vivekmind/core';
import { AuthType, CodingPlanRegion } from '@vivekmind/core';
import type { LoadedSettings } from '../../config/settings.js';
export interface OpenAICredentials {
    apiKey: string;
    baseUrl?: string;
    model?: string;
}
import { AuthState } from '../types.js';
import type { HistoryItem } from '../types.js';
import { type AlibabaStandardRegion } from '../../constants/alibabaStandardApiKey.js';
/**
 * Generate a managed env key from protocol and base URL.
 * Falls back to standard provider names if possible.
 */
export declare function generateCustomApiKeyEnvKey(protocol: string, _baseUrl: string): string;
/**
 * Normalize model IDs: split by comma, trim, deduplicate, remove empty.
 */
export declare function normalizeCustomModelIds(modelIdsInput: string): string[];
/**
 * Mask an API key for display: show first 3 and last 4 chars.
 */
export declare function maskApiKey(apiKey: string): string;
export type { VivekMindAuthState } from '../hooks/useVivekMindAuth.js';
export declare const useAuthCommand: (settings: LoadedSettings, config: Config, addItem: (item: Omit<HistoryItem, "id">, timestamp: number) => void, onAuthChange?: () => void) => {
    authState: AuthState;
    setAuthState: import("react").Dispatch<import("react").SetStateAction<AuthState>>;
    authError: string | null;
    onAuthError: (error: string | null) => void;
    isAuthDialogOpen: boolean;
    isAuthenticating: boolean;
    pendingAuthType: AuthType | undefined;
    setPendingAuthType: import("react").Dispatch<import("react").SetStateAction<AuthType | undefined>>;
    externalAuthState: {
        title: string;
        message: string;
        detail?: string;
    } | null;
    vivekmindAuthState: import("../hooks/useVivekMindAuth.js").VivekMindAuthState;
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
    openAuthDialog: () => void;
    cancelAuthentication: () => void;
};
