/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  type ContentGenerator,
  type ContentGeneratorConfig,
} from '../contentGenerator.js';
import type { Config } from '../../config/config.js';
import { OpenAIContentGenerator } from './openaiContentGenerator.js';
import {
  DashScopeOpenAICompatibleProvider,
  DeepSeekOpenAICompatibleProvider,
  ModelScopeOpenAICompatibleProvider,
  MiniMaxOpenAICompatibleProvider,
  OpenRouterOpenAICompatibleProvider,
  GroqOpenAICompatibleProvider,
  TogetherOpenAICompatibleProvider,
  XAIOpenAICompatibleProvider,
  MistralOpenAICompatibleProvider,
  AzureOpenAICompatibleProvider,
  CohereOpenAICompatibleProvider,
  HuggingFaceOpenAICompatibleProvider,
  type OpenAICompatibleProvider,
  DefaultOpenAICompatibleProvider,
} from './provider/index.js';

export { OpenAIContentGenerator } from './openaiContentGenerator.js';
export { ContentGenerationPipeline } from './pipeline.js';
export type { ErrorHandler, PipelineConfig, RequestContext } from './types.js';

export {
  type OpenAICompatibleProvider,
  DashScopeOpenAICompatibleProvider,
  DeepSeekOpenAICompatibleProvider,
  MiniMaxOpenAICompatibleProvider,
  OpenRouterOpenAICompatibleProvider,
  GroqOpenAICompatibleProvider,
  TogetherOpenAICompatibleProvider,
  XAIOpenAICompatibleProvider,
  MistralOpenAICompatibleProvider,
} from './provider/index.js';

export { OpenAIContentConverter } from './converter.js';

/**
 * Create an OpenAI-compatible content generator with the appropriate provider
 */
export function createOpenAIContentGenerator(
  contentGeneratorConfig: ContentGeneratorConfig,
  cliConfig: Config,
): ContentGenerator {
  const provider = determineProvider(contentGeneratorConfig, cliConfig);
  return new OpenAIContentGenerator(
    contentGeneratorConfig,
    cliConfig,
    provider,
  );
}

/**
 * Determine the appropriate provider based on configuration
 */
export function determineProvider(
  contentGeneratorConfig: ContentGeneratorConfig,
  cliConfig: Config,
): OpenAICompatibleProvider {
  const config =
    contentGeneratorConfig || cliConfig.getContentGeneratorConfig();
  const authType = config.authType;

  // Check for DashScope provider
  if (
    authType === AuthType.USE_DASHSCOPE ||
    DashScopeOpenAICompatibleProvider.isDashScopeProvider(config)
  ) {
    return new DashScopeOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Check for DeepSeek provider
  if (
    authType === AuthType.USE_DEEPSEEK ||
    DeepSeekOpenAICompatibleProvider.isDeepSeekProvider(config)
  ) {
    return new DeepSeekOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Check for OpenRouter provider
  if (
    authType === AuthType.USE_OPENROUTER ||
    OpenRouterOpenAICompatibleProvider.isOpenRouterProvider(config)
  ) {
    return new OpenRouterOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Check for ModelScope provider
  if (ModelScopeOpenAICompatibleProvider.isModelScopeProvider(config)) {
    return new ModelScopeOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Check for MiniMax provider
  if (MiniMaxOpenAICompatibleProvider.isMiniMaxProvider(config)) {
    return new MiniMaxOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Check for Groq provider
  if (
    authType === AuthType.USE_GROQ ||
    GroqOpenAICompatibleProvider.isGroqProvider(config)
  ) {
    return new GroqOpenAICompatibleProvider(contentGeneratorConfig, cliConfig);
  }

  // Check for Together AI provider
  if (
    authType === AuthType.USE_TOGETHER ||
    TogetherOpenAICompatibleProvider.isTogetherProvider(config)
  ) {
    return new TogetherOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Check for xAI/Grok provider
  if (
    authType === AuthType.USE_XAI ||
    XAIOpenAICompatibleProvider.isXAIProvider(config)
  ) {
    return new XAIOpenAICompatibleProvider(contentGeneratorConfig, cliConfig);
  }

  // Check for Mistral provider
  if (
    authType === AuthType.USE_MISTRAL ||
    MistralOpenAICompatibleProvider.isMistralProvider(config)
  ) {
    return new MistralOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Check for Azure provider
  if (
    authType === AuthType.USE_AZURE_OPENAI ||
    AzureOpenAICompatibleProvider.isAzureProvider(config)
  ) {
    return new AzureOpenAICompatibleProvider(contentGeneratorConfig, cliConfig);
  }

  // Check for Cohere provider
  if (
    authType === AuthType.USE_COHERE ||
    CohereOpenAICompatibleProvider.isCohereProvider(config)
  ) {
    return new CohereOpenAICompatibleProvider(contentGeneratorConfig, cliConfig);
  }

  // Check for Hugging Face provider
  if (
    authType === AuthType.USE_HF ||
    HuggingFaceOpenAICompatibleProvider.isHuggingFaceProvider(config)
  ) {
    return new HuggingFaceOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  // Default provider for standard OpenAI-compatible APIs
  return new DefaultOpenAICompatibleProvider(contentGeneratorConfig, cliConfig);
}

export { EnhancedErrorHandler } from './errorHandler.js';

