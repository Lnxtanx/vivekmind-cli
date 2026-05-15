/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';
/**
 * Provider for xAI's Grok models API.
 * Detects via api.x.ai hostname. Future-proofed for Grok-specific features.
 */
export declare class XAIOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    constructor(contentGeneratorConfig: ContentGeneratorConfig, cliConfig: Config);
    static isXAIProvider(config: ContentGeneratorConfig): boolean;
}
