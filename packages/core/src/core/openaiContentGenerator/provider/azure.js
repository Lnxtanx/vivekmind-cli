/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultOpenAICompatibleProvider } from './default.js';
import { AuthType } from '../../contentGenerator.js';
/**
 * Provider for Azure OpenAI
 */
export class AzureOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
    /**
     * Determine if the given configuration belongs to Azure OpenAI
     */
    static isAzureProvider(config) {
        if (config.authType === AuthType.USE_AZURE_OPENAI) {
            return true;
        }
        try {
            if (!config.baseUrl)
                return false;
            const hostname = new URL(config.baseUrl).hostname.toLowerCase();
            return hostname.includes('openai.azure.com');
        }
        catch {
            return false;
        }
    }
    buildHeaders() {
        const headers = super.buildHeaders();
        // Azure OpenAI uses 'api-key' header instead of 'Authorization: Bearer'
        if (this.contentGeneratorConfig.apiKey) {
            headers['api-key'] = this.contentGeneratorConfig.apiKey;
        }
        return headers;
    }
}
//# sourceMappingURL=azure.js.map