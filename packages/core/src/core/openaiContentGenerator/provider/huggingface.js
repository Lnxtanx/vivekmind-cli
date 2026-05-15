/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
import { AuthType } from '../../contentGenerator.js';
/**
 * Provider for Hugging Face Inference API
 */
export class HuggingFaceOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    /**
     * Determine if the given configuration belongs to Hugging Face
     */
    static isHuggingFaceProvider(config) {
        if (config.authType === AuthType.USE_HF) {
            return true;
        }
        try {
            if (!config.baseUrl)
                return false;
            const hostname = new URL(config.baseUrl).hostname.toLowerCase();
            return (hostname.includes('huggingface.co') ||
                hostname.includes('hf.co'));
        }
        catch {
            return false;
        }
    }
    buildHeaders() {
        const headers = super.buildHeaders();
        // Hugging Face might need specific headers in some cases,
        // but standard Bearer token usually works for the /v1 endpoints.
        return headers;
    }
}
//# sourceMappingURL=huggingface.js.map