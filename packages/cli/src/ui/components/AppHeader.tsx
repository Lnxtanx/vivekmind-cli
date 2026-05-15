/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { AuthType } from '@vivekmind/core';
import { Header } from './Header.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useUIState } from '../contexts/UIStateContext.js';

interface AppHeaderProps {
  version: string;
}

/**
 * Determine the auth display type based on auth type and configuration.
 */
function getAuthDisplayType(
  authType?: AuthType,
  baseUrl?: string,
): string {
  if (!authType) {
    return '—';
  }

  // Direct mappings for AuthType
  switch (authType) {
    case AuthType.USE_BEDROCK: return 'AWS Bedrock';
    case AuthType.USE_ANTHROPIC: return 'Anthropic Claude';
    case AuthType.USE_GEMINI:
    case AuthType.USE_VERTEX_AI: return 'Google Gemini';
    case AuthType.USE_AZURE_OPENAI: return 'Azure OpenAI';
    case AuthType.USE_ANTHROPIC_VERTEX_AI: return 'Anthropic Vertex AI';
    case AuthType.USE_MISTRAL: return 'Mistral';
    case AuthType.USE_DEEPSEEK: return 'DeepSeek';
    case AuthType.USE_GROQ: return 'Groq';
    case AuthType.USE_TOGETHER: return 'Together AI';
    case AuthType.USE_OPENROUTER: return 'OpenRouter';
    case AuthType.USE_XAI: return 'xAI (Grok)';
    case AuthType.USE_DASHSCOPE: return 'Alibaba DashScope';
    case AuthType.USE_OLLAMA: return 'Ollama (Local)';
    case AuthType.USE_LM_STUDIO: return 'LM Studio (Local)';
    case AuthType.USE_COHERE: return 'Cohere';
    case AuthType.USE_PERPLEXITY: return 'Perplexity';
    case AuthType.USE_FIREWORKS: return 'Fireworks AI';
    case AuthType.USE_SILICONFLOW: return 'SiliconFlow';
    case AuthType.USE_HF: return 'Hugging Face';
    case AuthType.USE_NOVITA: return 'Novita AI';
    case AuthType.USE_WATSONX: return 'IBM Watsonx';
    case AuthType.VIVEKMIND_OAUTH: return 'VivekMind OAuth';
    case AuthType.USE_OPENAI: return 'OpenAI';
  }

  if (baseUrl) {
    if (baseUrl.includes('groq.com')) return 'Groq';
    if (baseUrl.includes('mistral.ai')) return 'Mistral';
    if (baseUrl.includes('deepseek.com')) return 'DeepSeek';
    if (baseUrl.includes('together.xyz')) return 'Together AI';
    if (baseUrl.includes('openrouter.ai')) return 'OpenRouter';
    if (baseUrl.includes('localhost:11434')) return 'Ollama';
    if (baseUrl.includes('api.openai.com')) return 'OpenAI';
  }

  return 'API Key';
}

export const AppHeader = ({ version }: AppHeaderProps) => {
  const config = useConfig();
  const uiState = useUIState();

  const contentGeneratorConfig = config.getContentGeneratorConfig();
  
  // Prefer pendingAuthType during auth flow to show selected provider immediately
  const authType = uiState.pendingAuthType ?? contentGeneratorConfig?.authType;
  
  const model = uiState.currentModel;
  const targetDir = config.getTargetDir();
  const showBanner = !config.getScreenReader();

  const authDisplayType = getAuthDisplayType(
    authType,
    contentGeneratorConfig?.baseUrl,
  );

  return (
    <Box flexDirection="column">
      {showBanner && (
        <Header
          version={version}
          authDisplayType={authDisplayType}
          model={model}
          workingDirectory={targetDir}
        />
      )}
    </Box>
  );
};
