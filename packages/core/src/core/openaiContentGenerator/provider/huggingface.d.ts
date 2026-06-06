/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
import { type ContentGeneratorConfig } from '../../contentGenerator.js';
/**
 * Provider for Hugging Face Inference API
 */
export declare class HuggingFaceOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    /**
     * Determine if the given configuration belongs to Hugging Face
     */
    static isHuggingFaceProvider(config: ContentGeneratorConfig): boolean;
    buildHeaders(): Record<string, string | undefined>;
}
