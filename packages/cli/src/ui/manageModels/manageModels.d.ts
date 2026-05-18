/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType, type Config, type ProviderModelConfig as ModelConfig } from '@vivekmind/core';
import type { LoadedSettings } from '../../config/settings.js';
export declare const MANAGE_MODELS_SOURCES: readonly ["openrouter"];
export type ManageModelsSource = (typeof MANAGE_MODELS_SOURCES)[number];
export interface ManageModelsCatalogEntry {
    id: string;
    label: string;
    searchText: string;
    supportsVision: boolean;
    contextWindowSize?: number;
    badges: string[];
    model: ModelConfig;
}
export interface ManageModelsCatalog {
    source: ManageModelsSource;
    title: string;
    description: string;
    authType: AuthType;
    entries: ManageModelsCatalogEntry[];
}
export interface ManageModelsSaveResult {
    updatedConfigs: ModelConfig[];
    selectedIds: string[];
    activeModelId?: string;
}
export declare function fetchManageModelsCatalog(source: ManageModelsSource): Promise<ManageModelsCatalog>;
export declare function getEnabledModelIdsForSource(source: ManageModelsSource, settings: LoadedSettings): string[];
export declare function saveManageModelsSelection(params: {
    source: ManageModelsSource;
    selectedModels: ModelConfig[];
    settings: LoadedSettings;
    config: Config;
}): Promise<ManageModelsSaveResult>;
