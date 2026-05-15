/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
/**
 * Well-known Groq API hostnames for exact matching.
 * Uses URL parsing to avoid false positives from substring matching
 * (e.g., `api.groq.com.evil.com` would not match).
 */
const GROQ_KNOWN_HOSTS = ['api.groq.com'];
const GROQ_HOST_SUFFIX = '.groq.com';
/**
 * Provider for Groq's ultra-fast inference API.
 *
 * Groq is fully OpenAI-compatible but benefits from a detection class for:
 * - Source tracking header (`X-Groq-Source`) for analytics
 * - Default temperature tuning for coding tasks
 * - Future: custom rate-limit handling (Groq has unique TPM limits)
 */
export class GroqOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    constructor(contentGeneratorConfig, cliConfig) {
        super(contentGeneratorConfig, cliConfig);
    }
    /**
     * Detect whether the configuration targets a Groq API endpoint.
     * Uses safe URL hostname parsing — not substring matching.
     */
    static isGroqProvider(config) {
        if (!config.baseUrl)
            return false;
        try {
            const hostname = new URL(config.baseUrl).hostname.toLowerCase();
            if (GROQ_KNOWN_HOSTS.includes(hostname)) {
                return true;
            }
            return hostname.endsWith(GROQ_HOST_SUFFIX);
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
            'X-Groq-Source': 'vivekmind-cli',
        };
    }
    getDefaultGenerationConfig() {
        return {
            temperature: 0,
        };
    }
}
//# sourceMappingURL=groq.js.map