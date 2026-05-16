/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType } from '../core/contentGenerator.js';
import type { ModelConfig } from './types.js';
export interface DiscoveryOptions {
    baseUrl?: string;
    apiKey?: string;
}
/**
 * Service for discovering models from dynamic providers (Ollama, LM Studio, OpenRouter, etc.)
 */
export declare class ModelDiscoveryService {
    /**
     * Discover models for a given authType
     */
    discoverModels(authType: AuthType, options?: DiscoveryOptions): Promise<ModelConfig[]>;
    private discoverOllamaModels;
    private discoverLMStudioModels;
    private discoverOpenRouterModels;
}
