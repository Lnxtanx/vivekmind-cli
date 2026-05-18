/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType, resolveModelConfig, } from '@vivekmind/core';
/**
 * Env var names that hold model selections for each auth type.
 * Mirrors the model-var mappings in core's AUTH_ENV_MAPPINGS.
 */
const AUTH_ENV_MODEL_VARS = {
    [AuthType.USE_OPENAI]: ['OPENAI_MODEL', 'VIVEKMIND_MODEL'],
    [AuthType.USE_GEMINI]: ['GEMINI_MODEL'],
    [AuthType.USE_VERTEX_AI]: ['GOOGLE_MODEL'],
    [AuthType.USE_ANTHROPIC]: ['ANTHROPIC_MODEL'],
    [AuthType.VIVEKMIND_OAUTH]: [],
    [AuthType.USE_BEDROCK]: ['BEDROCK_MODEL'],
    [AuthType.USE_AZURE_OPENAI]: ['AZURE_OPENAI_MODEL'],
    [AuthType.USE_ANTHROPIC_VERTEX_AI]: ['ANTHROPIC_MODEL'],
    [AuthType.USE_MISTRAL]: ['MISTRAL_MODEL'],
    [AuthType.USE_DEEPSEEK]: ['DEEPSEEK_MODEL'],
    [AuthType.USE_GROQ]: ['GROQ_MODEL'],
    [AuthType.USE_TOGETHER]: ['TOGETHER_MODEL'],
    [AuthType.USE_OPENROUTER]: ['OPENROUTER_MODEL'],
    [AuthType.USE_XAI]: ['XAI_MODEL'],
    [AuthType.USE_DASHSCOPE]: ['DASHSCOPE_MODEL'],
    [AuthType.USE_OLLAMA]: ['OLLAMA_MODEL'],
    [AuthType.USE_LM_STUDIO]: ['LM_STUDIO_MODEL'],
    [AuthType.USE_COHERE]: ['COHERE_MODEL'],
    [AuthType.USE_PERPLEXITY]: ['PERPLEXITY_MODEL'],
    [AuthType.USE_FIREWORKS]: ['FIREWORKS_MODEL'],
    [AuthType.USE_SILICONFLOW]: ['SILICONFLOW_MODEL'],
    [AuthType.USE_HF]: ['HF_MODEL'],
    [AuthType.USE_NOVITA]: ['NOVITA_MODEL'],
    [AuthType.USE_WATSONX]: ['WATSONX_MODEL'],
};
export function getAuthTypeFromEnv() {
    if (process.env['VIVEKMIND_OAUTH']) {
        return AuthType.VIVEKMIND_OAUTH;
    }
    if (process.env['OPENAI_API_KEY'] &&
        process.env['OPENAI_MODEL'] &&
        process.env['OPENAI_BASE_URL']) {
        return AuthType.USE_OPENAI;
    }
    if (process.env['GEMINI_API_KEY'] && process.env['GEMINI_MODEL']) {
        return AuthType.USE_GEMINI;
    }
    if (process.env['GOOGLE_API_KEY'] && process.env['GOOGLE_MODEL']) {
        return AuthType.USE_VERTEX_AI;
    }
    if (process.env['ANTHROPIC_API_KEY'] &&
        process.env['ANTHROPIC_MODEL'] &&
        process.env['ANTHROPIC_BASE_URL']) {
        return AuthType.USE_ANTHROPIC;
    }
    if (process.env['AWS_ACCESS_KEY_ID'] &&
        process.env['AWS_SECRET_ACCESS_KEY'] &&
        process.env['BEDROCK_MODEL']) {
        return AuthType.USE_BEDROCK;
    }
    return undefined;
}
/**
 * Unified resolver for CLI generation config.
 *
 * Model precedence (all auth types):
 * - argv.model > settings.model.name > auth-specific env model vars
 *
 * Env var mapping by auth type (mirrors core's AUTH_ENV_MAPPINGS):
 * - USE_OPENAI: OPENAI_MODEL, VIVEKMIND_MODEL
 * - USE_GEMINI: GEMINI_MODEL
 * - USE_VERTEX_AI: GOOGLE_MODEL
 * - USE_ANTHROPIC: ANTHROPIC_MODEL
 *
 * When model is resolved from argv or settings, all model env vars are stripped
 * from the env passed to core's resolveModelConfig to prevent incorrect overrides.
 * When model is resolved from an auth-specific env var, only that env var is
 * kept in the filtered env so core can access the provider metadata.
 */
export function resolveCliGenerationConfig(inputs) {
    const { argv, settings, selectedAuthType } = inputs;
    const env = inputs.env ?? process.env;
    const authType = selectedAuthType;
    // Resolve the target model based on strict precedence:
    // argv.model > settings.model.name > auth-specific env model vars
    // Env vars are ONLY considered when neither argv.model nor settings.model.name is set.
    let resolvedModel;
    let sourceEnvVar;
    if (argv.model) {
        resolvedModel = argv.model;
    }
    else if (settings.model?.name) {
        resolvedModel = settings.model.name;
    }
    else if (authType && AUTH_ENV_MODEL_VARS[authType]) {
        // Only check env vars for the current auth type
        for (const envVar of AUTH_ENV_MODEL_VARS[authType]) {
            if (env[envVar]) {
                resolvedModel = env[envVar];
                sourceEnvVar = envVar;
                break;
            }
        }
    }
    // Find a matching provider for the resolved model (for metadata: generationConfig, envKey, etc.)
    // When resolvedModel is from settings and matches a provider, modelProvider.id == settings.model.name,
    // so the resolver correctly uses the settings-selected model (no override occurs).
    // The old candidate-loop code that fell through to OPENAI_MODEL is gone.
    let modelProvider;
    if (resolvedModel && authType && settings.modelProviders) {
        const providers = settings.modelProviders[authType];
        if (providers && Array.isArray(providers)) {
            modelProvider = providers.find((p) => p.id === resolvedModel);
        }
    }
    // Filter env to prevent auth-specific model env vars from overriding higher-priority sources.
    // sourceEnvVar is only set when the model was actually resolved from an env var (lines 119-128),
    // so this is source-based filtering, not value-based. If model came from argv or settings,
    // sourceEnvVar is undefined and ALL model env vars are stripped.
    // Build a list of ALL model env vars across all auth types.
    const allModelEnvVars = Object.values(AUTH_ENV_MODEL_VARS).flat();
    const filteredEnv = { ...env };
    if (sourceEnvVar) {
        // Keep only the env var that was actually used
        for (const envVar of allModelEnvVars) {
            if (envVar !== sourceEnvVar) {
                delete filteredEnv[envVar];
            }
        }
    }
    else {
        // Model was not resolved from env - strip ALL model env vars
        for (const envVar of allModelEnvVars) {
            delete filteredEnv[envVar];
        }
    }
    const configSources = {
        authType,
        cli: {
            model: argv.model,
            apiKey: argv.openaiApiKey,
            baseUrl: argv.openaiBaseUrl,
        },
        settings: {
            model: settings.model?.name,
            apiKey: settings.security?.auth?.apiKey,
            baseUrl: settings.security?.auth?.baseUrl,
            generationConfig: settings.model?.generationConfig,
        },
        modelProvider,
        env: filteredEnv,
    };
    const resolved = resolveModelConfig(configSources);
    // Resolve OpenAI logging config (CLI-specific, not part of core resolver)
    const enableOpenAILogging = (typeof argv.openaiLogging === 'undefined'
        ? settings.model?.enableOpenAILogging
        : argv.openaiLogging) ?? false;
    const openAILoggingDir = argv.openaiLoggingDir || settings.model?.openAILoggingDir;
    // Build the full generation config
    // Note: we merge the resolved config with logging settings
    const generationConfig = {
        ...resolved.config,
        enableOpenAILogging,
        openAILoggingDir,
    };
    return {
        model: resolved.config.model || '',
        apiKey: resolved.config.apiKey || '',
        baseUrl: resolved.config.baseUrl || '',
        generationConfig,
        sources: resolved.sources,
        warnings: resolved.warnings,
    };
}
//# sourceMappingURL=modelConfigUtils.js.map