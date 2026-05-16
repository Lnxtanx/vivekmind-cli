/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';
/**
 * Provider for Mistral AI's API.
 * Detects via api.mistral.ai hostname.
 * Future-proofed for Codestral FIM support and Mistral-specific features.
 */
export declare class MistralOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    constructor(contentGeneratorConfig: ContentGeneratorConfig, cliConfig: Config);
    static isMistralProvider(config: ContentGeneratorConfig): boolean;
}
