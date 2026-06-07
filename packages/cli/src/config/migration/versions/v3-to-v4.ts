/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SettingsMigration } from '../types.js';

/**
 * Mapping of legacy VivekMind protocol names to standard environment variable names.
 */
const LEGACY_KEY_TO_STANDARD_MAP: Record<string, string> = {
  OPENAI: 'OPENAI_API_KEY',
  ANTHROPIC: 'ANTHROPIC_API_KEY',
  GEMINI: 'GEMINI_API_KEY',
  DEEPSEEK: 'DEEPSEEK_API_KEY',
  MISTRAL: 'MISTRAL_API_KEY',
  GROQ: 'GROQ_API_KEY',
  TOGETHER: 'TOGETHER_API_KEY',
  OPENROUTER: 'OPENROUTER_API_KEY',
  XAI: 'XAI_API_KEY',
  DASHSCOPE: 'DASHSCOPE_API_KEY',
  COHERE: 'COHERE_API_KEY',
  PERPLEXITY: 'PERPLEXITY_API_KEY',
  FIREWORKS: 'FIREWORKS_API_KEY',
  SILICONFLOW: 'SILICONFLOW_API_KEY',
  HUGGING_FACE: 'HF_TOKEN',
  NOVITA: 'NOVITA_API_KEY',
  WATSONX: 'WATSONX_APIKEY',
  MOONSHOT: 'MOONSHOT_API_KEY',
  REKA: 'REKA_API_KEY',
};

/**
 * V3 -> V4 migration (managed env key standardization and rebranding).
 */
export class V3ToV4Migration implements SettingsMigration {
  readonly fromVersion = 3;
  readonly toVersion = 4;

  shouldMigrate(settings: unknown): boolean {
    if (typeof settings !== 'object' || settings === null) {
      return false;
    }

    const s = settings as Record<string, unknown>;
    return s['$version'] === 3;
  }

  migrate(
    settings: unknown,
    scope: string,
  ): { settings: unknown; warnings: string[] } {
    if (typeof settings !== 'object' || settings === null) {
      throw new Error('Settings must be an object');
    }

    const result = structuredClone(settings) as Record<string, unknown>;
    const warnings: string[] = [];

    const env = result['env'] as Record<string, unknown> | undefined;
    const modelProviders = result['modelProviders'] as Record<string, any[]> | undefined;

    if (env) {
      const legacyPrefixes = ['QWEN_CUSTOM_API_KEY_', 'VIVEKMIND_CUSTOM_API_KEY_'];
      const keysToMigrate = Object.keys(env).filter(key => 
        legacyPrefixes.some(p => key.startsWith(p))
      );

      for (const oldKey of keysToMigrate) {
        const prefix = legacyPrefixes.find(p => oldKey.startsWith(p))!;
        const parts = oldKey.slice(prefix.length).split('_');
        const protocol = parts[0];
        const standardKey = protocol ? LEGACY_KEY_TO_STANDARD_MAP[protocol] : null;

        if (standardKey) {
          const value = env[oldKey];
          // Move to new key if it doesn't already have a value
          if (!env[standardKey]) {
            env[standardKey] = value;
          }
          delete env[oldKey];

          // Update model entries
          if (modelProviders) {
            for (const providerId of Object.keys(modelProviders)) {
              const models = modelProviders[providerId];
              if (Array.isArray(models)) {
                for (const model of models) {
                  if (model.envKey === oldKey) {
                    model.envKey = standardKey;
                  }
                }
              }
            }
          }
          
          warnings.push(`Migrated legacy API key for ${protocol} to standard '${standardKey}' naming in ${scope} settings.`);
        }
      }
    }

    // Always update version to 4
    result['$version'] = 4;

    return { settings: result, warnings };
  }
}

export const v3ToV4Migration = new V3ToV4Migration();
