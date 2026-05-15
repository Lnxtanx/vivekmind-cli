/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType, } from '@vivekmind/core';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import { OPENROUTER_DEFAULT_MODEL, fetchOpenRouterModels, isOpenRouterConfig, mergeOpenRouterConfigs, } from '../../commands/auth/openrouterOAuth.js';
export const MANAGE_MODELS_SOURCES = ['openrouter'];
function isFreeOpenRouterModel(modelId) {
    const normalizedId = modelId.toLowerCase();
    return normalizedId.includes(':free') || normalizedId === 'openrouter/free';
}
function getManageModelsDisplayLabel(source, model) {
    const rawLabel = model.name || model.id;
    switch (source) {
        case 'openrouter':
            return rawLabel.replace(/^OpenRouter\s*·\s*/i, '').trim() || model.id;
        default:
            return rawLabel;
    }
}
function createEntry(source, model) {
    const contextWindowSize = model.generationConfig?.contextWindowSize;
    const supportsVision = model.capabilities?.vision === true;
    const badges = [];
    if (isFreeOpenRouterModel(model.id)) {
        badges.push('free');
    }
    if (supportsVision) {
        badges.push('vision');
    }
    if (typeof contextWindowSize === 'number' && contextWindowSize >= 1_000_000) {
        badges.push('long-context');
    }
    const displayLabel = getManageModelsDisplayLabel(source, model);
    return {
        id: model.id,
        label: displayLabel,
        searchText: [model.id, model.name, displayLabel, ...badges]
            .filter(Boolean)
            .join(' '),
        supportsVision,
        contextWindowSize,
        badges,
        model,
    };
}
export async function fetchManageModelsCatalog(source) {
    switch (source) {
        case 'openrouter': {
            const models = await fetchOpenRouterModels();
            return {
                source,
                title: 'OpenRouter',
                description: 'Browse the latest OpenRouter model catalog and choose which models are enabled locally.',
                authType: AuthType.USE_OPENAI,
                entries: models.map((model) => createEntry(source, model)),
            };
        }
        default:
            throw new Error(`Unsupported manage models source: ${source}`);
    }
}
export function getEnabledModelIdsForSource(source, settings) {
    const modelProviders = settings.merged.modelProviders;
    const openaiConfigs = modelProviders?.[AuthType.USE_OPENAI] || [];
    switch (source) {
        case 'openrouter':
            return openaiConfigs
                .filter((config) => isOpenRouterConfig(config))
                .map((config) => config.id);
        default:
            return [];
    }
}
export async function saveManageModelsSelection(params) {
    const { source, selectedModels, settings, config } = params;
    const persistScope = getPersistScopeForModelSelection(settings);
    const mergedModelProviders = settings.merged.modelProviders;
    const existingOpenAIConfigs = mergedModelProviders?.[AuthType.USE_OPENAI] || [];
    switch (source) {
        case 'openrouter': {
            const updatedConfigs = mergeOpenRouterConfigs(existingOpenAIConfigs, selectedModels);
            if (updatedConfigs.length === 0) {
                throw new Error('At least one OpenAI-compatible model must remain enabled.');
            }
            settings.setValue(persistScope, `modelProviders.${AuthType.USE_OPENAI}`, updatedConfigs);
            const selectedIds = selectedModels.map((model) => model.id);
            const currentAuthType = config.getContentGeneratorConfig()?.authType;
            const currentModelId = config.getModel();
            const currentModelStillAvailable = currentModelId
                ? updatedConfigs.some((model) => model.id === currentModelId)
                : false;
            let activeModelId = currentModelId;
            if (!currentModelStillAvailable) {
                const preferredDefault = updatedConfigs.find((model) => model.id === OPENROUTER_DEFAULT_MODEL);
                activeModelId = preferredDefault?.id || updatedConfigs[0]?.id;
                if (activeModelId) {
                    settings.setValue(persistScope, 'model.name', activeModelId);
                }
            }
            const updatedModelProviders = {
                ...(mergedModelProviders || {}),
                [AuthType.USE_OPENAI]: updatedConfigs,
            };
            config.reloadModelProvidersConfig(updatedModelProviders);
            if (currentAuthType === AuthType.USE_OPENAI) {
                await config.refreshAuth(AuthType.USE_OPENAI);
            }
            return {
                updatedConfigs,
                selectedIds,
                activeModelId,
            };
        }
        default:
            throw new Error(`Unsupported manage models source: ${source}`);
    }
}
//# sourceMappingURL=manageModels.js.map