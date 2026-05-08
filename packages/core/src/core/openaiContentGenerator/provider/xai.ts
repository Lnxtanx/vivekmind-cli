/**
 * @license
 * Copyright 2025 VivekMind Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';

const XAI_KNOWN_HOSTS = ['api.x.ai'] as const;

/**
 * Provider for xAI's Grok models API.
 * Detects via api.x.ai hostname. Future-proofed for Grok-specific features.
 */
export class XAIOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    super(contentGeneratorConfig, cliConfig);
  }

  static isXAIProvider(config: ContentGeneratorConfig): boolean {
    if (!config.baseUrl) return false;
    try {
      const hostname = new URL(config.baseUrl).hostname.toLowerCase();
      return (
        (XAI_KNOWN_HOSTS as readonly string[]).includes(hostname) ||
        hostname.endsWith('.x.ai')
      );
    } catch {
      return false;
    }
  }
}
