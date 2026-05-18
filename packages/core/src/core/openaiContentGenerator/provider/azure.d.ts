/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
import { type ContentGeneratorConfig } from '../../contentGenerator.js';
/**
 * Provider for Azure OpenAI
 */
export declare class AzureOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    /**
     * Determine if the given configuration belongs to Azure OpenAI
     */
    static isAzureProvider(config: ContentGeneratorConfig): boolean;
    buildHeaders(): Record<string, string | undefined>;
}
