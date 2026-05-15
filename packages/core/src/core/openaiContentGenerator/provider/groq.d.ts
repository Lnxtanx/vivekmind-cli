/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import type { GenerateContentConfig } from '@google/genai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';
/**
 * Provider for Groq's ultra-fast inference API.
 *
 * Groq is fully OpenAI-compatible but benefits from a detection class for:
 * - Source tracking header (`X-Groq-Source`) for analytics
 * - Default temperature tuning for coding tasks
 * - Future: custom rate-limit handling (Groq has unique TPM limits)
 */
export declare class GroqOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    constructor(contentGeneratorConfig: ContentGeneratorConfig, cliConfig: Config);
    /**
     * Detect whether the configuration targets a Groq API endpoint.
     * Uses safe URL hostname parsing — not substring matching.
     */
    static isGroqProvider(config: ContentGeneratorConfig): boolean;
    buildHeaders(): Record<string, string | undefined>;
    getDefaultGenerationConfig(): GenerateContentConfig;
}
