/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';

/**
 * Well-known Together AI API hostnames for exact matching.
 * Uses URL parsing to avoid false positives from substring matching.
 */
const TOGETHER_KNOWN_HOSTS = ['api.together.xyz'] as const;
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
  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    super(contentGeneratorConfig, cliConfig);
  }

  /**
   * Detect whether the configuration targets a Together AI endpoint.
   * Uses safe URL hostname parsing — not substring matching.
   */
  static isTogetherProvider(config: ContentGeneratorConfig): boolean {
    if (!config.baseUrl) return false;

    try {
      const hostname = new URL(config.baseUrl).hostname.toLowerCase();
      if ((TOGETHER_KNOWN_HOSTS as readonly string[]).includes(hostname)) {
        return true;
      }
      return hostname.endsWith(TOGETHER_HOST_SUFFIX);
    } catch {
      return false;
    }
  }

  override buildHeaders(): Record<string, string | undefined> {
    const baseHeaders = super.buildHeaders();

    return {
      ...baseHeaders,
      // Generic source identifier — no user-identifiable information
      'X-Together-Source': 'vivekmind-cli',
    };
  }
}
