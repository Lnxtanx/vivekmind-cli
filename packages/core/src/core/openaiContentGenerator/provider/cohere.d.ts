/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
import { type ContentGeneratorConfig } from '../../contentGenerator.js';
/**
 * Provider for Cohere (via OpenAI compatibility layer)
 */
export declare class CohereOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    /**
     * Determine if the given configuration belongs to Cohere
     */
    static isCohereProvider(config: ContentGeneratorConfig): boolean;
    buildHeaders(): Record<string, string | undefined>;
}
