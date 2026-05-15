/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
/**
 * Well-known Together AI API hostnames for exact matching.
 * Uses URL parsing to avoid false positives from substring matching.
 */
const TOGETHER_KNOWN_HOSTS = ['api.together.xyz'];
const TOGETHER_HOST_SUFFIX = '.together.xyz';
/**
 * Provider for Together AI's inference API.
 *
 * Together AI is fully OpenAI-compatible. The detection class enables:
 * - Source tracking header for analytics
 * - Future: custom max_tokens handling for large models
 * - Future: Together-specific model routing features
 */
export class TogetherOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    constructor(contentGeneratorConfig, cliConfig) {
        super(contentGeneratorConfig, cliConfig);
    }
    /**
     * Detect whether the configuration targets a Together AI endpoint.
     * Uses safe URL hostname parsing — not substring matching.
     */
    static isTogetherProvider(config) {
        if (!config.baseUrl)
            return false;
        try {
            const hostname = new URL(config.baseUrl).hostname.toLowerCase();
            if (TOGETHER_KNOWN_HOSTS.includes(hostname)) {
                return true;
            }
            return hostname.endsWith(TOGETHER_HOST_SUFFIX);
        }
        catch {
            return false;
        }
    }
    buildHeaders() {
        const baseHeaders = super.buildHeaders();
        return {
            ...baseHeaders,
            // Generic source identifier — no user-identifiable information
            'X-Together-Source': 'vivekmind-cli',
        };
    }
}
//# sourceMappingURL=together.js.map