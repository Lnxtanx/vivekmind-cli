/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Config,
  ContentGeneratorConfig,
  ModelProvidersConfig,
  ProviderModelConfig,
} from '@vivekmind/core';
import {
  AuthEvent,
  AuthType,
  getErrorMessage,
  logAuth,
  getCodingPlanConfig,
  isCodingPlanConfig,
  CodingPlanRegion,
  CODING_PLAN_ENV_KEY,
} from '@vivekmind/core';
import { useCallback, useEffect, useState } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
// OpenAICredentials type (previously imported from OpenAIKeyPrompt)
export interface OpenAICredentials {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}
import { useVivekMindAuth } from '../hooks/useVivekMindAuth.js';
import { AuthState, MessageType } from '../types.js';
import type { HistoryItem } from '../types.js';
import { t } from '../../i18n/index.js';
import { backupSettingsFile } from '../../utils/settingsUtils.js';
import {
  ALIBABA_STANDARD_API_KEY_ENDPOINTS,
  DASHSCOPE_STANDARD_API_KEY_ENV_KEY,
  type AlibabaStandardRegion,
} from '../../constants/alibabaStandardApiKey.js';
import {
  applyOpenRouterModelsConfiguration,
  createOpenRouterOAuthSession,
  OPENROUTER_OAUTH_CALLBACK_URL,
  runOpenRouterOAuthLogin,
} from '../../commands/auth/openrouterOAuth.js';

/**
 * Generate a managed env key from protocol and base URL.
 * Falls back to standard provider names if possible.
 */
export function generateCustomApiKeyEnvKey(
  protocol: string,
  _baseUrl: string,
): string {
  // Mapping of protocols to their standard API key environment variables
  const protocolToStandardKey: Record<string, string> = {
    [AuthType.USE_OPENAI]: 'OPENAI_API_KEY',
    [AuthType.USE_ANTHROPIC]: 'ANTHROPIC_API_KEY',
    [AuthType.USE_GEMINI]: 'GEMINI_API_KEY',
    [AuthType.USE_AZURE_OPENAI]: 'AZURE_OPENAI_API_KEY',
    [AuthType.USE_DEEPSEEK]: 'DEEPSEEK_API_KEY',
    [AuthType.USE_MISTRAL]: 'MISTRAL_API_KEY',
    [AuthType.USE_GROQ]: 'GROQ_API_KEY',
    [AuthType.USE_TOGETHER]: 'TOGETHER_API_KEY',
    [AuthType.USE_OPENROUTER]: 'OPENROUTER_API_KEY',
    [AuthType.USE_XAI]: 'XAI_API_KEY',
    [AuthType.USE_DASHSCOPE]: 'DASHSCOPE_API_KEY',
    [AuthType.USE_COHERE]: 'COHERE_API_KEY',
    [AuthType.USE_PERPLEXITY]: 'PERPLEXITY_API_KEY',
    [AuthType.USE_FIREWORKS]: 'FIREWORKS_API_KEY',
    [AuthType.USE_SILICONFLOW]: 'SILICONFLOW_API_KEY',
    [AuthType.USE_HF]: 'HF_TOKEN',
    [AuthType.USE_NOVITA]: 'NOVITA_API_KEY',
    [AuthType.USE_WATSONX]: 'WATSONX_APIKEY',
  };

  const standardKey = protocolToStandardKey[protocol];
  if (standardKey) {
    return standardKey;
  }

  // Fallback for unknown protocols or custom setups
  const normalize = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

  return `VIVEKMIND_CUSTOM_API_KEY_${normalize(protocol)}_${normalize(_baseUrl)}`;
}

/**
 * Normalize model IDs: split by comma, trim, deduplicate, remove empty.
 */
export function normalizeCustomModelIds(modelIdsInput: string): string[] {
  return modelIdsInput
    .split(',')
    .map((id) => id.trim())
    .filter((id, index, array) => id.length > 0 && array.indexOf(id) === index);
}

/**
 * Mask an API key for display: show first 3 and last 4 chars.
 */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return '(not set)';
  if (trimmed.length <= 6) return '***';
  const head = trimmed.slice(0, 3);
  const tail = trimmed.slice(-4);
  return `${head}...${tail}`;
}

export type { VivekMindAuthState } from '../hooks/useVivekMindAuth.js';

export const useAuthCommand = (
  settings: LoadedSettings,
  config: Config,
  addItem: (item: Omit<HistoryItem, 'id'>, timestamp: number) => void,
  onAuthChange?: () => void,
) => {
  const unAuthenticated = config.getAuthType() === undefined;

  const [authState, setAuthState] = useState<AuthState>(
    unAuthenticated ? AuthState.Updating : AuthState.Unauthenticated,
  );

  const [authError, setAuthError] = useState<string | null>(null);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(unAuthenticated);
  const [pendingAuthType, setPendingAuthType] = useState<AuthType | undefined>(
    undefined,
  );
  const [externalAuthState, setExternalAuthState] = useState<{
    title: string;
    message: string;
    detail?: string;
  } | null>(null);
  const [openRouterAuthAbortController, setOpenRouterAuthAbortController] =
    useState<AbortController | null>(null);

  const { vivekmindAuthState, cancelVivekMindAuth } = useVivekMindAuth(
    pendingAuthType,
    isAuthenticating,
  );

  const onAuthError = useCallback(
    (error: string | null) => {
      setAuthError(error);
      if (error) {
        setAuthState(AuthState.Updating);
        setIsAuthDialogOpen(true);
      }
    },
    [setAuthError, setAuthState],
  );

  const handleAuthFailure = useCallback(
    (error: unknown) => {
      setIsAuthenticating(false);
      setExternalAuthState(null);
      const errorMessage = t('Failed to authenticate. Message: {{message}}', {
        message: getErrorMessage(error),
      });
      onAuthError(errorMessage);

      // Log authentication failure
      if (pendingAuthType) {
        const authEvent = new AuthEvent(
          pendingAuthType,
          'manual',
          'error',
          errorMessage,
        );
        logAuth(config, authEvent);
      }
    },
    [onAuthError, pendingAuthType, config],
  );

  const handleAuthSuccess = useCallback(
    async (authType: AuthType, credentials?: OpenAICredentials) => {
      try {
        const authTypeScope = getPersistScopeForModelSelection(settings);

        // Persist authType
        settings.setValue(
          authTypeScope,
          'security.auth.selectedType',
          authType,
        );

        // Persist model from ContentGenerator config (handles fallback cases)
        // This ensures that when syncAfterAuthRefresh falls back to default model,
        // it gets persisted to settings.json
        const contentGeneratorConfig = config.getContentGeneratorConfig();
        if (contentGeneratorConfig?.model) {
          settings.setValue(
            authTypeScope,
            'model.name',
            contentGeneratorConfig.model,
          );
        }

        // Only update credentials if not switching to VIVEKMIND_OAUTH,
        // so that OpenAI credentials are preserved when switching to VIVEKMIND_OAUTH.
        if (authType !== AuthType.VIVEKMIND_OAUTH && credentials) {
          if (credentials?.apiKey != null) {
            settings.setValue(
              authTypeScope,
              'security.auth.apiKey',
              credentials.apiKey,
            );
          }
          if (credentials?.baseUrl != null) {
            settings.setValue(
              authTypeScope,
              'security.auth.baseUrl',
              credentials.baseUrl,
            );
          }
        }
      } catch (error) {
        handleAuthFailure(error);
        return;
      }

      setAuthError(null);
      setAuthState(AuthState.Authenticated);
      setPendingAuthType(undefined);
      setIsAuthDialogOpen(false);
      setIsAuthenticating(false);

      // Trigger UI refresh to update header information
      onAuthChange?.();

      // Add success message to history
      addItem(
        {
          type: MessageType.INFO,
          text: t('Authenticated successfully with {{authType}} credentials.', {
            authType,
          }),
        },
        Date.now(),
      );

      // Log authentication success
      const authEvent = new AuthEvent(authType, 'manual', 'success');
      logAuth(config, authEvent);
    },
    [settings, handleAuthFailure, config, addItem, onAuthChange],
  );

  const performAuth = useCallback(
    async (authType: AuthType, credentials?: OpenAICredentials) => {
      try {
        await config.refreshAuth(authType);
        handleAuthSuccess(authType, credentials);
      } catch (e) {
        handleAuthFailure(e);
      }
    },
    [config, handleAuthSuccess, handleAuthFailure],
  );

  const isProviderManagedModel = useCallback(
    (authType: AuthType, modelId: string | undefined) => {
      if (!modelId) {
        return false;
      }

      const modelProviders = settings.merged.modelProviders as
        | ModelProvidersConfig
        | undefined;
      if (!modelProviders) {
        return false;
      }
      const providerModels = modelProviders[authType];
      if (!Array.isArray(providerModels)) {
        return false;
      }
      return providerModels.some(
        (providerModel) => providerModel.id === modelId,
      );
    },
    [settings],
  );

  const handleAuthSelect = useCallback(
    async (authType: AuthType | undefined, credentials?: OpenAICredentials) => {
      if (!authType) {
        setIsAuthDialogOpen(false);
        setAuthError(null);
        return;
      }

      if (
        authType === AuthType.USE_OPENAI &&
        credentials?.model &&
        isProviderManagedModel(authType, credentials.model)
      ) {
        onAuthError(
          t(
            'Model "{{modelName}}" is managed via settings.modelProviders. Please complete the fields in settings, or use another model id.',
            { modelName: credentials.model },
          ),
        );
        return;
      }

      setPendingAuthType(authType);
      setAuthError(null);
      setIsAuthDialogOpen(false);
      setIsAuthenticating(true);

      if (authType === AuthType.USE_OPENAI) {
        if (credentials) {
          // Pass settings.model.generationConfig to updateCredentials so it can be merged
          // after clearing provider-sourced config. This ensures settings.json generationConfig
          // fields (e.g., samplingParams, timeout) are preserved.
          const settingsGenerationConfig = settings.merged.model
            ?.generationConfig as Partial<ContentGeneratorConfig> | undefined;
          config.updateCredentials(
            {
              apiKey: credentials.apiKey,
              baseUrl: credentials.baseUrl,
              model: credentials.model,
            },
            settingsGenerationConfig,
          );
          await performAuth(authType, credentials);
        }
        return;
      }

      await performAuth(authType);
    },
    [
      config,
      performAuth,
      isProviderManagedModel,
      onAuthError,
      settings.merged.model?.generationConfig,
    ],
  );

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const cancelAuthentication = useCallback(() => {
    if (isAuthenticating && pendingAuthType === AuthType.VIVEKMIND_OAUTH) {
      cancelVivekMindAuth();
    }


    if (isAuthenticating && pendingAuthType === AuthType.USE_OPENAI) {
      openRouterAuthAbortController?.abort();
      setOpenRouterAuthAbortController(null);
    }

    // Log authentication cancellation
    if (isAuthenticating && pendingAuthType) {
      const authEvent = new AuthEvent(pendingAuthType, 'manual', 'cancelled');
      logAuth(config, authEvent);
    }

    // Do not reset pendingAuthType here, persist the previously selected type.
    setIsAuthenticating(false);
    setExternalAuthState(null);
    setIsAuthDialogOpen(true);
    setAuthError(null);
  }, [
    isAuthenticating,
    pendingAuthType,
    cancelVivekMindAuth,
    config,
    openRouterAuthAbortController,
  ]);

  /**
   * Handle coding plan submission - generates configs from template and stores api-key
   * @param apiKey - The API key to store
   * @param region - The region to use (default: CHINA)
   */
  const handleCodingPlanSubmit = useCallback(
    async (
      apiKey: string,
      region: CodingPlanRegion = CodingPlanRegion.CHINA,
    ) => {
      try {
        setIsAuthenticating(true);
        setAuthError(null);

        // Get configuration based on region
        const { template, version } = getCodingPlanConfig(region);

        // Get persist scope
        const persistScope = getPersistScopeForModelSelection(settings);

        // Backup settings file before modification
        const settingsFile = settings.forScope(persistScope);
        backupSettingsFile(settingsFile.path);

        // Store api-key in settings.env (unified env key)
        settings.setValue(persistScope, `env.${CODING_PLAN_ENV_KEY}`, apiKey);

        // Sync to process.env immediately so refreshAuth can read the apiKey
        process.env[CODING_PLAN_ENV_KEY] = apiKey;

        // Generate model configs from template
        const newConfigs: ProviderModelConfig[] = template.map(
          (templateConfig) => ({
            ...templateConfig,
            envKey: CODING_PLAN_ENV_KEY,
          }),
        );

        // Get existing configs
        const existingConfigs =
          (
            settings.merged.modelProviders as ModelProvidersConfig | undefined
          )?.[AuthType.USE_OPENAI] || [];

        // Filter out all existing Coding Plan configs (mutually exclusive)
        const nonCodingPlanConfigs = existingConfigs.filter(
          (existing) => !isCodingPlanConfig(existing.baseUrl, existing.envKey),
        );

        // Add new Coding Plan configs at the beginning
        const updatedConfigs = [...newConfigs, ...nonCodingPlanConfigs];

        // Persist to modelProviders
        settings.setValue(
          persistScope,
          `modelProviders.${AuthType.USE_OPENAI}`,
          updatedConfigs,
        );

        // Also persist authType
        settings.setValue(
          persistScope,
          'security.auth.selectedType',
          AuthType.USE_OPENAI,
        );

        // Persist coding plan region
        settings.setValue(persistScope, 'codingPlan.region', region);

        // Persist coding plan version (single field for backward compatibility)
        settings.setValue(persistScope, 'codingPlan.version', version);

        // If there are configs, use the first one as the model
        if (updatedConfigs.length > 0 && updatedConfigs[0]?.id) {
          settings.setValue(persistScope, 'model.name', updatedConfigs[0].id);
        }

        // Hot-reload model providers configuration before refreshAuth
        // This ensures ModelsConfig has the latest configuration from settings.json
        const updatedModelProviders: ModelProvidersConfig = {
          ...(settings.merged.modelProviders as
            | ModelProvidersConfig
            | undefined),
          [AuthType.USE_OPENAI]: updatedConfigs,
        };
        config.reloadModelProvidersConfig(updatedModelProviders);

        // Refresh auth with the new configuration
        await config.refreshAuth(AuthType.USE_OPENAI);

        // Success handling
        setAuthError(null);
        setAuthState(AuthState.Authenticated);
        setIsAuthDialogOpen(false);
        setIsAuthenticating(false);

        // Trigger UI refresh
        onAuthChange?.();

        // Add success message
        addItem(
          {
            type: MessageType.INFO,
            text: t(
              'Authenticated successfully with {{region}}. API key and model configs saved to settings.json.',
              { region: t('Alibaba Cloud Coding Plan') },
            ),
          },
          Date.now(),
        );

        // Hint about /model command
        addItem(
          {
            type: MessageType.INFO,
            text: t(
              'Tip: Use /model to switch between available Coding Plan models.',
            ),
          },
          Date.now(),
        );

        // Log success
        const authEvent = new AuthEvent(
          AuthType.USE_OPENAI,
          'coding-plan',
          'success',
        );
        logAuth(config, authEvent);
      } catch (error) {
        handleAuthFailure(error);
      }
    },
    [settings, config, handleAuthFailure, addItem, onAuthChange],
  );

  /**
   * Handle Alibaba Cloud standard API key flow.
   * Persists key to env.DASHSCOPE_API_KEY and creates a modelProviders.openai entry.
   */
  const handleAlibabaStandardSubmit = useCallback(
    async (
      apiKey: string,
      region: AlibabaStandardRegion,
      modelIdsInput: string,
    ) => {
      try {
        setIsAuthenticating(true);
        setAuthError(null);

        const trimmedApiKey = apiKey.trim();
        const modelIds = modelIdsInput
          .split(',')
          .map((id) => id.trim())
          .filter(
            (id, index, array) => id.length > 0 && array.indexOf(id) === index,
          );
        if (!trimmedApiKey) {
          throw new Error(t('API key cannot be empty.'));
        }
        if (modelIds.length === 0) {
          throw new Error(t('Model IDs cannot be empty.'));
        }

        const baseUrl = ALIBABA_STANDARD_API_KEY_ENDPOINTS[region];
        const persistScope = getPersistScopeForModelSelection(settings);

        const settingsFile = settings.forScope(persistScope);
        backupSettingsFile(settingsFile.path);

        settings.setValue(
          persistScope,
          `env.${DASHSCOPE_STANDARD_API_KEY_ENV_KEY}`,
          trimmedApiKey,
        );
        process.env[DASHSCOPE_STANDARD_API_KEY_ENV_KEY] = trimmedApiKey;

        const newConfigs: ProviderModelConfig[] = modelIds.map((modelId) => ({
          id: modelId,
          name: `[ModelStudio Standard] ${modelId}`,
          baseUrl,
          envKey: DASHSCOPE_STANDARD_API_KEY_ENV_KEY,
        }));

        const existingConfigs =
          (
            settings.merged.modelProviders as ModelProvidersConfig | undefined
          )?.[AuthType.USE_OPENAI] || [];

        const nonAlibabaStandardConfigs = existingConfigs.filter(
          (existing) =>
            !(
              existing.envKey === DASHSCOPE_STANDARD_API_KEY_ENV_KEY &&
              typeof existing.baseUrl === 'string' &&
              Object.values(ALIBABA_STANDARD_API_KEY_ENDPOINTS).includes(
                existing.baseUrl,
              )
            ),
        );

        const updatedConfigs = [...newConfigs, ...nonAlibabaStandardConfigs];

        settings.setValue(
          persistScope,
          `modelProviders.${AuthType.USE_OPENAI}`,
          updatedConfigs,
        );
        settings.setValue(
          persistScope,
          'security.auth.selectedType',
          AuthType.USE_OPENAI,
        );
        settings.setValue(persistScope, 'model.name', modelIds[0]);

        const updatedModelProviders: ModelProvidersConfig = {
          ...(settings.merged.modelProviders as
            | ModelProvidersConfig
            | undefined),
          [AuthType.USE_OPENAI]: updatedConfigs,
        };
        config.reloadModelProvidersConfig(updatedModelProviders);
        await config.refreshAuth(AuthType.USE_OPENAI);

        setAuthError(null);
        setAuthState(AuthState.Authenticated);
        setPendingAuthType(undefined);
        setIsAuthDialogOpen(false);
        setIsAuthenticating(false);
        onAuthChange?.();

        addItem(
          {
            type: MessageType.INFO,
            text: t(
              'Alibaba Cloud ModelStudio Standard API Key successfully entered. Settings updated with env.DASHSCOPE_API_KEY and {{modelCount}} model(s).',
              { modelCount: String(modelIds.length) },
            ),
          },
          Date.now(),
        );

        addItem(
          {
            type: MessageType.INFO,
            text: t(
              'You can use /model to see new ModelStudio Standard models and switch between them.',
            ),
          },
          Date.now(),
        );

        const authEvent = new AuthEvent(
          AuthType.USE_OPENAI,
          'manual',
          'success',
        );
        logAuth(config, authEvent);
      } catch (error) {
        handleAuthFailure(error);
      }
    },
    [settings, config, handleAuthFailure, addItem, onAuthChange],
  );

  const handleOpenRouterSubmit = useCallback(async () => {
    try {
      setPendingAuthType(AuthType.USE_OPENAI);
      setIsAuthenticating(true);
      setAuthError(null);
      setIsAuthDialogOpen(false);

      const oauthSession = createOpenRouterOAuthSession(
        OPENROUTER_OAUTH_CALLBACK_URL,
      );
      setExternalAuthState({
        title: t('OpenRouter Authentication'),
        message: t(
          'Open the authorization page if your browser does not launch automatically.',
        ),
        detail: oauthSession.authorizationUrl,
      });

      const abortController = new AbortController();
      setOpenRouterAuthAbortController(abortController);
      const oauthResult = await runOpenRouterOAuthLogin(
        OPENROUTER_OAUTH_CALLBACK_URL,
        {
          abortSignal: abortController.signal,
          session: oauthSession,
        },
      );
      setOpenRouterAuthAbortController(null);
      setExternalAuthState({
        title: t('OpenRouter Authentication'),
        message: t('Finalizing OpenRouter setup...'),
        detail: t(
          'Syncing OpenRouter models and updating your local configuration.',
        ),
      });
      const selectedKey = oauthResult.apiKey;
      if (!selectedKey) {
        throw new Error(
          t('OpenRouter authentication completed without an API key.'),
        );
      }

      const persistScope = getPersistScopeForModelSelection(settings);
      const settingsFile = settings.forScope(persistScope);
      backupSettingsFile(settingsFile.path);

      await applyOpenRouterModelsConfiguration({
        settings,
        config,
        apiKey: selectedKey,
        reloadConfig: true,
      });
      await config.refreshAuth(AuthType.USE_OPENAI);

      setAuthError(null);
      setExternalAuthState(null);
      setAuthState(AuthState.Authenticated);
      setPendingAuthType(undefined);
      setIsAuthDialogOpen(false);
      setIsAuthenticating(false);
      onAuthChange?.();

      addItem(
        {
          type: MessageType.INFO,
          text: t('Successfully configured OpenRouter.'),
        },
        Date.now(),
      );

      addItem(
        {
          type: MessageType.INFO,
          text: t('Use /model to switch models.'),
        },
        Date.now(),
      );

      addItem(
        {
          type: MessageType.INFO,
          text: t(
            'Want more OpenRouter models? Use /manage-models to browse and enable them.',
          ),
        },
        Date.now(),
      );

      const authEvent = new AuthEvent(AuthType.USE_OPENAI, 'manual', 'success');
      logAuth(config, authEvent);
    } catch (error) {
      setOpenRouterAuthAbortController(null);
      if (error instanceof DOMException && error.name === 'AbortError') {
        setExternalAuthState(null);
        setPendingAuthType(undefined);
        setIsAuthenticating(false);
        setIsAuthDialogOpen(true);
        return;
      }
      handleAuthFailure(error);
    }
  }, [
    settings,
    config,
    handleAuthFailure,
    addItem,
    onAuthChange,
    setOpenRouterAuthAbortController,
  ]);

  /**
   * Handle custom API key setup wizard submission.
   * Persists key to env[generatedEnvKey] and creates modelProviders entries.
   */
  const handleCustomApiKeySubmit = useCallback(
    async (
      protocol: AuthType,
      baseUrl: string,
      apiKey: string,
      modelIdsInput: string,
      generationConfig?: {
        enableThinking?: boolean;
        multimodal?: {
          image?: boolean;
          video?: boolean;
          audio?: boolean;
        };
        maxTokens?: number;
      },
    ) => {
      try {
        setIsAuthenticating(true);
        setAuthError(null);

        const trimmedApiKey = apiKey.trim();
        const trimmedBaseUrl = baseUrl.trim();
        const modelIds = normalizeCustomModelIds(modelIdsInput);

        // Providers that have SDK-provided default base URLs
        const nativeProviders = [
          AuthType.USE_GEMINI,
          AuthType.USE_VERTEX_AI,
          AuthType.USE_ANTHROPIC_VERTEX_AI,
          AuthType.USE_ANTHROPIC,
          AuthType.USE_BEDROCK,
        ];

        if (!trimmedApiKey) {
          throw new Error(t('API key cannot be empty.'));
        }

        const isNative = nativeProviders.includes(protocol);
        if (!trimmedBaseUrl && !isNative) {
          throw new Error(t('Base URL cannot be empty.'));
        }
        if (trimmedBaseUrl && !/^https?:\/\//i.test(trimmedBaseUrl)) {
          throw new Error(t('Base URL must start with http:// or https://.'));
        }
        if (modelIds.length === 0) {
          throw new Error(t('Model IDs cannot be empty.'));
        }

        // --- API Key Validation ---
        if (apiKey !== 'local-provider') {
          try {
            if (protocol === AuthType.USE_GEMINI) {
              const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedApiKey}`;
              const res = await fetch(testUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
            } else if (protocol === AuthType.USE_ANTHROPIC) {
              const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'x-api-key': trimmedApiKey,
                  'anthropic-version': '2023-06-01',
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'claude-3-haiku-20240307',
                  max_tokens: 1,
                  messages: [{ role: 'user', content: 'hi' }],
                }),
              });
              if (res.status === 401 || res.status === 403) throw new Error('Invalid API Key');
            } else if (
              protocol === AuthType.USE_VERTEX_AI ||
              protocol === AuthType.USE_ANTHROPIC_VERTEX_AI ||
              protocol === AuthType.USE_BEDROCK
            ) {
              // Skip validation for providers that use cloud credentials/ADC
            } else if (trimmedBaseUrl) {
              // OpenAI-compatible validation
              const res = await fetch(`${trimmedBaseUrl}/models`, {
                headers: { Authorization: `Bearer ${trimmedApiKey}` },
              });
              if (res.status === 401 || res.status === 403) throw new Error('Invalid API Key');
            }
          } catch (e) {
            throw new Error(t('API key verification failed. Please check your key and try again. ({{error}})', { error: (e as Error).message }));
          }
        }

        const generatedEnvKey = generateCustomApiKeyEnvKey(
          protocol,
          trimmedBaseUrl,
        );
        const persistScope = getPersistScopeForModelSelection(settings);

        const settingsFile = settings.forScope(persistScope);
        backupSettingsFile(settingsFile.path);

        // Persist API key to env
        settings.setValue(
          persistScope,
          `env.${generatedEnvKey}`,
          trimmedApiKey,
        );
        process.env[generatedEnvKey] = trimmedApiKey;

        // Build generationConfig if any option is set
        let genConfig: ProviderModelConfig['generationConfig'] | undefined;
        if (generationConfig) {
          const hasThinking = generationConfig.enableThinking === true;
          const hasMultimodal =
            generationConfig.multimodal &&
            (generationConfig.multimodal.image === true ||
              generationConfig.multimodal.video === true ||
              generationConfig.multimodal.audio === true);
          const hasMaxTokens =
            generationConfig.maxTokens !== undefined &&
            generationConfig.maxTokens > 0;

          if (hasThinking || hasMultimodal || hasMaxTokens) {
            genConfig = {};
            if (hasMultimodal) {
              genConfig.modalities = {
                image: generationConfig.multimodal!.image ?? false,
                video: generationConfig.multimodal!.video ?? false,
                audio: generationConfig.multimodal!.audio ?? false,
              };
            }
            if (hasThinking) {
              genConfig.extra_body = { enable_thinking: true };
            }
            if (hasMaxTokens) {
              genConfig.samplingParams = {
                max_tokens: generationConfig.maxTokens,
              };
            }
          }
        }

        // Build new model configs
        const newConfigs: ProviderModelConfig[] = modelIds.map((modelId) => ({
          id: modelId,
          name: modelId,
          baseUrl: trimmedBaseUrl,
          envKey: generatedEnvKey,
          ...(genConfig ? { generationConfig: genConfig } : {}),
        }));

        // Merge with existing configs: replace same generatedEnvKey, preserve rest
        const existingConfigs =
          (
            settings.merged.modelProviders as ModelProvidersConfig | undefined
          )?.[protocol] || [];

        const preservedConfigs = existingConfigs.filter(
          (existing) => existing.envKey !== generatedEnvKey,
        );

        const updatedConfigs = [...newConfigs, ...preservedConfigs];

        // Persist modelProviders, security, model
        settings.setValue(
          persistScope,
          `modelProviders.${protocol}`,
          updatedConfigs,
        );
        settings.setValue(persistScope, 'security.auth.selectedType', protocol);
        settings.setValue(persistScope, 'model.name', modelIds[0]);

        // Hot-reload before refreshAuth
        const updatedModelProviders: ModelProvidersConfig = {
          ...(settings.merged.modelProviders as
            | ModelProvidersConfig
            | undefined),
          [protocol]: updatedConfigs,
        };
        config.reloadModelProvidersConfig(updatedModelProviders);
        await config.refreshAuth(protocol);

        setAuthError(null);
        setAuthState(AuthState.Authenticated);
        setPendingAuthType(undefined);
        setIsAuthDialogOpen(false);
        setIsAuthenticating(false);
        onAuthChange?.();

        addItem(
          {
            type: MessageType.INFO,
            text: t(
              'Custom API Key authenticated successfully. Settings updated with generated env key and model provider config.',
            ),
          },
          Date.now(),
        );

        addItem(
          {
            type: MessageType.INFO,
            text: t('Tip: Use /model to switch between configured models.'),
          },
          Date.now(),
        );

        const authEvent = new AuthEvent(protocol, 'manual', 'success');
        logAuth(config, authEvent);
      } catch (error) {
        handleAuthFailure(error);
      }
    },
    [settings, config, handleAuthFailure, addItem, onAuthChange],
  );

  /**
   /**
    * We previously used a useEffect to trigger authentication automatically when
    * settings.security.auth.selectedType changed. This caused problems: if authentication failed,
    * the UI could get stuck, since settings.json would update before success. Now, we
    * update selectedType in settings only when authentication fully succeeds.
    * Authentication is triggered explicitly—either during initial app startup or when the
    * user switches methods—not reactively through settings changes. This avoids repeated
    * or broken authentication cycles.
    */
  useEffect(() => {
    const defaultAuthType = process.env['VIVEKMIND_DEFAULT_AUTH_TYPE'];
    if (
      defaultAuthType &&
      ![
        AuthType.VIVEKMIND_OAUTH,
        AuthType.USE_OPENAI,
        AuthType.USE_ANTHROPIC,
        AuthType.USE_GEMINI,
        AuthType.USE_VERTEX_AI,
        AuthType.USE_BEDROCK,
        AuthType.USE_AZURE_OPENAI,
        AuthType.USE_MISTRAL,
        AuthType.USE_DEEPSEEK,
        AuthType.USE_GROQ,
        AuthType.USE_TOGETHER,
        AuthType.USE_OPENROUTER,
        AuthType.USE_XAI,
        AuthType.USE_DASHSCOPE,
        AuthType.USE_OLLAMA,
        AuthType.USE_LM_STUDIO,
        AuthType.USE_COHERE,
        AuthType.USE_PERPLEXITY,
        AuthType.USE_FIREWORKS,
        AuthType.USE_SILICONFLOW,
        AuthType.USE_HF,
        AuthType.USE_NOVITA,
        AuthType.USE_WATSONX,
      ].includes(defaultAuthType as AuthType)
    ) {
      onAuthError(
        t(
          'Invalid VIVEKMIND_DEFAULT_AUTH_TYPE value: "{{value}}". Valid values are: {{validValues}}',
          {
            value: defaultAuthType,
            validValues: [
              AuthType.VIVEKMIND_OAUTH,
              AuthType.USE_OPENAI,
              AuthType.USE_ANTHROPIC,
              AuthType.USE_GEMINI,
              AuthType.USE_VERTEX_AI,
            ].join(', '),
          },
        ),
      );
    }
  }, [onAuthError]);

  /**
   * Handle AWS Bedrock credentials submission.
   */
  const handleBedrockCredentialsSubmit = useCallback(
    async (
      accessKeyId: string,
      secretAccessKey: string,
      region: string,
      modelIdsInput: string,
    ) => {
      try {
        setIsAuthenticating(true);
        setAuthError(null);

        const trimmedAccessKeyId = accessKeyId.trim();
        const trimmedSecretAccessKey = secretAccessKey.trim();
        const trimmedRegion = region.trim() || 'us-east-1';
        const modelIds = normalizeCustomModelIds(modelIdsInput);

        if (!trimmedAccessKeyId || !trimmedSecretAccessKey) {
          throw new Error(t('AWS Access Key ID and Secret Access Key are required.'));
        }

        const persistScope = getPersistScopeForModelSelection(settings);
        const settingsFile = settings.forScope(persistScope);
        backupSettingsFile(settingsFile.path);

        // Persist AWS credentials to env
        settings.setValue(persistScope, 'env.AWS_ACCESS_KEY_ID', trimmedAccessKeyId);
        settings.setValue(persistScope, 'env.AWS_SECRET_ACCESS_KEY', trimmedSecretAccessKey);
        settings.setValue(persistScope, 'env.AWS_REGION', trimmedRegion);

        // Sync to process.env
        process.env['AWS_ACCESS_KEY_ID'] = trimmedAccessKeyId;
        process.env['AWS_SECRET_ACCESS_KEY'] = trimmedSecretAccessKey;
        process.env['AWS_REGION'] = trimmedRegion;

        // Build model configs
        const newConfigs: ProviderModelConfig[] = modelIds.map((modelId) => ({
          id: modelId,
          name: modelId,
        }));

        // Merge with existing Bedrock configs
        const existingConfigs =
          (
            settings.merged.modelProviders as ModelProvidersConfig | undefined
          )?.[AuthType.USE_BEDROCK] || [];

        const updatedConfigs = [...newConfigs, ...existingConfigs.filter(e => !modelIds.includes(e.id))];

        // Persist
        settings.setValue(
          persistScope,
          `modelProviders.${AuthType.USE_BEDROCK}`,
          updatedConfigs,
        );
        settings.setValue(persistScope, 'security.auth.selectedType', AuthType.USE_BEDROCK);
        settings.setValue(persistScope, 'model.name', modelIds[0]);

        // Hot-reload
        const updatedModelProviders: ModelProvidersConfig = {
          ...(settings.merged.modelProviders as
            | ModelProvidersConfig
            | undefined),
          [AuthType.USE_BEDROCK]: updatedConfigs,
        };
        config.reloadModelProvidersConfig(updatedModelProviders);
        await config.refreshAuth(AuthType.USE_BEDROCK);

        setAuthError(null);
        setAuthState(AuthState.Authenticated);
        setPendingAuthType(undefined);
        setIsAuthDialogOpen(false);
        setIsAuthenticating(false);
        onAuthChange?.();

        addItem(
          {
            type: MessageType.INFO,
            text: t('AWS Bedrock credentials configured successfully.'),
          },
          Date.now(),
        );

        const authEvent = new AuthEvent(AuthType.USE_BEDROCK, 'manual', 'success');
        logAuth(config, authEvent);
      } catch (error) {
        handleAuthFailure(error);
      }
    },
    [settings, config, handleAuthFailure, addItem, onAuthChange],
  );

  /**
   * Handle Google Vertex AI credentials submission.
   */
  const handleVertexCredentialsSubmit = useCallback(
    async (
      protocol: AuthType,
      projectId: string,
      location: string,
      modelIdsInput: string,
    ) => {
      try {
        setIsAuthenticating(true);
        setAuthError(null);

        const trimmedProjectId = projectId.trim();
        const trimmedLocation = location.trim() || 'us-central1';
        const modelIds = normalizeCustomModelIds(modelIdsInput);

        if (!trimmedProjectId) {
          throw new Error(t('Google Cloud Project ID is required.'));
        }

        const persistScope = getPersistScopeForModelSelection(settings);
        const settingsFile = settings.forScope(persistScope);
        backupSettingsFile(settingsFile.path);

        // Persist Vertex credentials to env
        // Using standard naming convention: GOOGLE_PROJECT_ID, GOOGLE_LOCATION
        settings.setValue(persistScope, 'env.GOOGLE_CLOUD_PROJECT', trimmedProjectId);
        settings.setValue(persistScope, 'env.GOOGLE_CLOUD_LOCATION', trimmedLocation);

        // Sync to process.env
        process.env['GOOGLE_CLOUD_PROJECT'] = trimmedProjectId;
        process.env['GOOGLE_CLOUD_LOCATION'] = trimmedLocation;

        // Build model configs
        const newConfigs: ProviderModelConfig[] = modelIds.map((modelId) => ({
          id: modelId,
          name: modelId,
        }));

        // Merge with existing configs
        const existingConfigs =
          (
            settings.merged.modelProviders as ModelProvidersConfig | undefined
          )?.[protocol] || [];

        const updatedConfigs = [...newConfigs, ...existingConfigs.filter(e => !modelIds.includes(e.id))];

        // Persist
        settings.setValue(
          persistScope,
          `modelProviders.${protocol}`,
          updatedConfigs,
        );
        settings.setValue(persistScope, 'security.auth.selectedType', protocol);
        settings.setValue(persistScope, 'model.name', modelIds[0]);

        // Hot-reload
        const updatedModelProviders: ModelProvidersConfig = {
          ...(settings.merged.modelProviders as
            | ModelProvidersConfig
            | undefined),
          [protocol]: updatedConfigs,
        };
        config.reloadModelProvidersConfig(updatedModelProviders);
        await config.refreshAuth(protocol);

        setAuthError(null);
        setAuthState(AuthState.Authenticated);
        setPendingAuthType(undefined);
        setIsAuthDialogOpen(false);
        setIsAuthenticating(false);
        onAuthChange?.();

        addItem(
          {
            type: MessageType.INFO,
            text: t('Google Vertex AI credentials configured successfully.'),
          },
          Date.now(),
        );

        const authEvent = new AuthEvent(protocol, 'manual', 'success');
        logAuth(config, authEvent);
      } catch (error) {
        handleAuthFailure(error);
      }
    },
    [settings, config, handleAuthFailure, addItem, onAuthChange],
  );

  return {
    authState,
    setAuthState,
    authError,
    onAuthError,
    isAuthDialogOpen,
    isAuthenticating,
    pendingAuthType,
    setPendingAuthType,
    externalAuthState,
    vivekmindAuthState,
    handleAuthSelect,
    handleCodingPlanSubmit,
    handleAlibabaStandardSubmit,
    handleOpenRouterSubmit,
    handleCustomApiKeySubmit,
    handleBedrockCredentialsSubmit,
    handleVertexCredentialsSubmit,
    openAuthDialog,
    cancelAuthentication,
  };
};
