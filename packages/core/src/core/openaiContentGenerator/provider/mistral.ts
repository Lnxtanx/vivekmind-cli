/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';

const MISTRAL_KNOWN_HOSTS = ['api.mistral.ai'] as const;
const MISTRAL_HOST_SUFFIX = '.mistral.ai';

/**
 * Provider for Mistral AI's API.
 * Detects via api.mistral.ai hostname.
 * Future-proofed for Codestral FIM support and Mistral-specific features.
 */
export class MistralOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    super(contentGeneratorConfig, cliConfig);
  }

  static isMistralProvider(config: ContentGeneratorConfig): boolean {
    if (!config.baseUrl) return false;
    try {
      const hostname = new URL(config.baseUrl).hostname.toLowerCase();
      if ((MISTRAL_KNOWN_HOSTS as readonly string[]).includes(hostname)) {
        return true;
      }
      return hostname.endsWith(MISTRAL_HOST_SUFFIX);
    } catch {
      return false;
    }
  }
}
