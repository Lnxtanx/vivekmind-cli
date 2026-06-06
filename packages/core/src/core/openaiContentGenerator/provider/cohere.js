/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
import { AuthType } from '../../contentGenerator.js';
/**
 * Provider for Cohere (via OpenAI compatibility layer)
 */
export class CohereOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    /**
     * Determine if the given configuration belongs to Cohere
     */
    static isCohereProvider(config) {
        if (config.authType === AuthType.USE_COHERE) {
            return true;
        }
        try {
            if (!config.baseUrl)
                return false;
            const hostname = new URL(config.baseUrl).hostname.toLowerCase();
            return hostname.includes('cohere.com') || hostname.includes('cohere.ai');
        }
        catch {
            return false;
        }
    }
    buildHeaders() {
        const headers = super.buildHeaders();
        // Cohere's /compatibility/v1 endpoint uses standard Bearer token
        return headers;
    }
}
//# sourceMappingURL=cohere.js.map