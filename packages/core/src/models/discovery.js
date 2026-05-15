/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType } from '../core/contentGenerator.js';
/**
 * Service for discovering models from dynamic providers (Ollama, LM Studio, OpenRouter, etc.)
 */
export class ModelDiscoveryService {
    /**
     * Discover models for a given authType
     */
    async discoverModels(authType, options = {}) {
        switch (authType) {
            case AuthType.USE_OLLAMA:
                return this.discoverOllamaModels(options.baseUrl || 'http://localhost:11434');
            case AuthType.USE_LM_STUDIO:
                return this.discoverLMStudioModels(options.baseUrl || 'http://localhost:1234/v1');
            case AuthType.USE_OPENROUTER:
                return this.discoverOpenRouterModels(options.apiKey);
            default:
                return [];
        }
    }
    async discoverOllamaModels(baseUrl) {
        try {
            const response = await fetch(`${baseUrl}/api/tags`);
            if (!response.ok)
                return [];
            const data = (await response.json());
            return data.models.map((m) => ({
                id: m.name,
                name: m.name,
                baseUrl: `${baseUrl}/v1`,
                description: `Local model running on Ollama: ${m.name}`,
            }));
        }
        catch {
            return [];
        }
    }
    async discoverLMStudioModels(baseUrl) {
        try {
            const response = await fetch(`${baseUrl}/models`);
            if (!response.ok)
                return [];
            const data = (await response.json());
            return data.data.map((m) => ({
                id: m.id,
                name: m.id,
                baseUrl,
                description: `Local model running on LM Studio: ${m.id}`,
            }));
        }
        catch {
            return [];
        }
    }
    async discoverOpenRouterModels(apiKey) {
        if (!apiKey)
            return [];
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });
            if (!response.ok)
                return [];
            const data = (await response.json());
            return data.data.map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                baseUrl: 'https://openrouter.ai/api/v1',
                envKey: 'OPENROUTER_API_KEY',
            }));
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=discovery.js.map