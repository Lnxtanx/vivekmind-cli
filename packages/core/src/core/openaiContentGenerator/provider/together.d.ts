/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';
/**
 * Provider for Together AI's inference API.
 *
 * Together AI is fully OpenAI-compatible. The detection class enables:
 * - Source tracking header for analytics
 * - Future: custom max_tokens handling for large models
 * - Future: Together-specific model routing features
 */
export declare class TogetherOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    constructor(contentGeneratorConfig: ContentGeneratorConfig, cliConfig: Config);
    /**
     * Detect whether the configuration targets a Together AI endpoint.
     * Uses safe URL hostname parsing — not substring matching.
     */
    static isTogetherProvider(config: ContentGeneratorConfig): boolean;
    buildHeaders(): Record<string, string | undefined>;
}
