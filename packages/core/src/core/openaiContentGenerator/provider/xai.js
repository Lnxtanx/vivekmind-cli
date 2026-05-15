/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
const XAI_KNOWN_HOSTS = ['api.x.ai'];
/**
 * Provider for xAI's Grok models API.
 * Detects via api.x.ai hostname. Future-proofed for Grok-specific features.
 */
export class XAIOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    constructor(contentGeneratorConfig, cliConfig) {
        super(contentGeneratorConfig, cliConfig);
    }
    static isXAIProvider(config) {
        if (!config.baseUrl)
            return false;
        try {
            const hostname = new URL(config.baseUrl).hostname.toLowerCase();
            return (XAI_KNOWN_HOSTS.includes(hostname) ||
                hostname.endsWith('.x.ai'));
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=xai.js.map