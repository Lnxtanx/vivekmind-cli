/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LoggingContentGenerator } from './loggingContentGenerator/index.js';
import { getDefaultApiKeyEnvVar, getDefaultModelEnvVar, MissingAnthropicBaseUrlEnvError, MissingApiKeyError, MissingBaseUrlError, MissingModelError, StrictMissingCredentialsError, StrictMissingModelIdError, } from '../models/modelConfigErrors.js';
import { PROVIDER_SOURCED_FIELDS } from '../models/modelsConfig.js';
export var AuthType;
(function (AuthType) {
    AuthType["USE_OPENAI"] = "openai";
    AuthType["VIVEKMIND_OAUTH"] = "vivekmind-oauth";
    AuthType["USE_GEMINI"] = "gemini";
    AuthType["USE_VERTEX_AI"] = "vertex-ai";
    AuthType["USE_ANTHROPIC"] = "anthropic";
    AuthType["USE_BEDROCK"] = "bedrock";
    AuthType["USE_AZURE_OPENAI"] = "azure-openai";
    AuthType["USE_ANTHROPIC_VERTEX_AI"] = "anthropic-vertex-ai";
    AuthType["USE_MISTRAL"] = "mistral";
    AuthType["USE_DEEPSEEK"] = "deepseek";
    AuthType["USE_GROQ"] = "groq";
    AuthType["USE_TOGETHER"] = "together";
    AuthType["USE_OPENROUTER"] = "openrouter";
    AuthType["USE_XAI"] = "xai";
    AuthType["USE_DASHSCOPE"] = "dashscope";
    AuthType["USE_OLLAMA"] = "ollama";
    AuthType["USE_LM_STUDIO"] = "lm-studio";
    AuthType["USE_COHERE"] = "cohere";
    AuthType["USE_PERPLEXITY"] = "perplexity";
    AuthType["USE_FIREWORKS"] = "fireworks";
    AuthType["USE_SILICONFLOW"] = "siliconflow";
    AuthType["USE_HF"] = "huggingface";
    AuthType["USE_NOVITA"] = "novita";
    AuthType["USE_WATSONX"] = "watsonx";
})(AuthType || (AuthType = {}));
function setSource(sources, path, source) {
    sources[path] = source;
}
function getSeedSource(seed, path) {
    return seed?.[path];
}
/**
 * Resolve ContentGeneratorConfig while tracking the source of each effective field.
 *
 * This function now primarily validates and finalizes the configuration that has
 * already been resolved by ModelConfigResolver. The env fallback logic has been
 * moved to the unified resolver to eliminate duplication.
 *
 * Note: The generationConfig passed here should already be fully resolved with
 * proper source tracking from the caller (CLI/SDK layer).
 */
export function resolveContentGeneratorConfigWithSources(config, authType, generationConfig, seedSources, options) {
    const sources = { ...(seedSources || {}) };
    const strictModelProvider = options?.strictModelProvider === true;
    // Build config with computed fields
    const newContentGeneratorConfig = {
        ...(generationConfig || {}),
        authType,
        proxy: config?.getProxy(),
    };
    // Set sources for computed fields
    setSource(sources, 'authType', {
        kind: 'computed',
        detail: 'provided by caller',
    });
    if (config?.getProxy()) {
        setSource(sources, 'proxy', {
            kind: 'computed',
            detail: 'Config.getProxy()',
        });
    }
    // Preserve seed sources for fields that were passed in
    const seedOrUnknown = (path) => getSeedSource(seedSources, path) ?? { kind: 'unknown' };
    for (const field of PROVIDER_SOURCED_FIELDS) {
        if (generationConfig && field in generationConfig && !sources[field]) {
            setSource(sources, field, seedOrUnknown(field));
        }
    }
    // Validate required fields based on authType. This does not perform any
    // fallback resolution (resolution is handled by ModelConfigResolver).
    const validation = validateModelConfig(newContentGeneratorConfig, strictModelProvider);
    if (!validation.valid) {
        throw new Error(validation.errors.map((e) => e.message).join('\n'));
    }
    return {
        config: newContentGeneratorConfig,
        sources,
    };
}
/**
 * Validate a resolved model configuration.
 * This is the single validation entry point used across Core.
 */
export function validateModelConfig(config, isStrictModelProvider = false) {
    const errors = [];
    // VivekMind OAuth doesn't need validation - it uses dynamic tokens
    if (config.authType === AuthType.VIVEKMIND_OAUTH) {
        return { valid: true, errors: [] };
    }
    // Bedrock uses AWS IAM credentials (env vars), not API keys
    if (config.authType === AuthType.USE_BEDROCK) {
        if (!config.model) {
            const envKey = getDefaultModelEnvVar(config.authType);
            errors.push(new MissingModelError({ authType: config.authType, envKey }));
        }
        return { valid: errors.length === 0, errors };
    }
    // API key is required for all other auth types
    if (!config.apiKey) {
        if (isStrictModelProvider) {
            errors.push(new StrictMissingCredentialsError(config.authType, config.model, config.apiKeyEnvKey));
        }
        else {
            const envKey = config.apiKeyEnvKey || getDefaultApiKeyEnvVar(config.authType);
            errors.push(new MissingApiKeyError({
                authType: config.authType,
                model: config.model,
                baseUrl: config.baseUrl,
                envKey,
            }));
        }
    }
    // Model is required
    if (!config.model) {
        if (isStrictModelProvider) {
            errors.push(new StrictMissingModelIdError(config.authType));
        }
        else {
            const envKey = getDefaultModelEnvVar(config.authType);
            errors.push(new MissingModelError({ authType: config.authType, envKey }));
        }
    }
    // Explicit baseUrl is required for Anthropic; Migrated from existing code.
    if (config.authType === AuthType.USE_ANTHROPIC && !config.baseUrl) {
        if (isStrictModelProvider) {
            errors.push(new MissingBaseUrlError({
                authType: config.authType,
                model: config.model,
            }));
        }
        else if (config.authType === AuthType.USE_ANTHROPIC) {
            errors.push(new MissingAnthropicBaseUrlEnvError());
        }
    }
    return { valid: errors.length === 0, errors };
}
export function createContentGeneratorConfig(config, authType, generationConfig) {
    return resolveContentGeneratorConfigWithSources(config, authType, generationConfig).config;
}
export async function createContentGenerator(generatorConfig, config, isInitialAuth) {
    const validation = validateModelConfig(generatorConfig, false);
    if (!validation.valid) {
        throw new Error(validation.errors.map((e) => e.message).join('\n'));
    }
    const authType = generatorConfig.authType;
    if (!authType) {
        throw new Error('ContentGeneratorConfig must have an authType');
    }
    let baseGenerator;
    if (authType === AuthType.USE_OPENAI ||
        authType === AuthType.USE_AZURE_OPENAI ||
        authType === AuthType.USE_DEEPSEEK ||
        authType === AuthType.USE_MISTRAL ||
        authType === AuthType.USE_GROQ ||
        authType === AuthType.USE_TOGETHER ||
        authType === AuthType.USE_OPENROUTER ||
        authType === AuthType.USE_XAI ||
        authType === AuthType.USE_DASHSCOPE ||
        authType === AuthType.USE_OLLAMA ||
        authType === AuthType.USE_LM_STUDIO ||
        authType === AuthType.USE_COHERE ||
        authType === AuthType.USE_PERPLEXITY ||
        authType === AuthType.USE_FIREWORKS ||
        authType === AuthType.USE_SILICONFLOW ||
        authType === AuthType.USE_HF ||
        authType === AuthType.USE_NOVITA) {
        const { createOpenAIContentGenerator } = await import('./openaiContentGenerator/index.js');
        baseGenerator = createOpenAIContentGenerator(generatorConfig, config);
    }
    else if (authType === AuthType.VIVEKMIND_OAUTH) {
        const { getVivekMindOAuthClient } = await import('../vivekmind/vivekmindOAuth2.js');
        const { VivekMindContentGenerator } = await import('../vivekmind/vivekmindContentGenerator.js');
        try {
            const vivekmindClient = await getVivekMindOAuthClient(config, isInitialAuth ? { requireCachedCredentials: true } : undefined);
            baseGenerator = new VivekMindContentGenerator(vivekmindClient, generatorConfig, config);
        }
        catch (error) {
            throw new Error(`${error instanceof Error ? error.message : String(error)}`);
        }
    }
    else if (authType === AuthType.USE_ANTHROPIC) {
        const { createAnthropicContentGenerator } = await import('./anthropicContentGenerator/index.js');
        baseGenerator = createAnthropicContentGenerator(generatorConfig, config);
    }
    else if (authType === AuthType.USE_GEMINI ||
        authType === AuthType.USE_VERTEX_AI) {
        const { createGeminiContentGenerator } = await import('./geminiContentGenerator/index.js');
        baseGenerator = createGeminiContentGenerator(generatorConfig, config);
    }
    else if (authType === AuthType.USE_BEDROCK) {
        const { createBedrockContentGenerator } = await import('./bedrockContentGenerator/index.js');
        baseGenerator = createBedrockContentGenerator(generatorConfig, config);
    }
    else {
        throw new Error(`Error creating contentGenerator: Unsupported authType: ${authType}`);
    }
    return new LoggingContentGenerator(baseGenerator, config, generatorConfig);
}
//# sourceMappingURL=contentGenerator.js.map