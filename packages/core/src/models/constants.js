/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { DEFAULT_VIVEKMIND_MODEL, MAINLINE_CODER_MODEL } from '../config/models.js';
import { AuthType } from '../core/contentGenerator.js';
/**
 * Field keys for model-scoped generation config.
 *
 * Kept in a small standalone module to avoid circular deps. The `import('...')`
 * usage is type-only and does not emit runtime imports.
 */
export const MODEL_GENERATION_CONFIG_FIELDS = [
    'samplingParams',
    'timeout',
    'maxRetries',
    'retryErrorCodes',
    'enableCacheControl',
    'schemaCompliance',
    'reasoning',
    'contextWindowSize',
    'customHeaders',
    'extra_body',
    'modalities',
    'splitToolMedia',
];
/**
 * Credential-related fields that are part of ContentGeneratorConfig
 * but not ModelGenerationConfig.
 */
export const CREDENTIAL_FIELDS = [
    'model',
    'apiKey',
    'apiKeyEnvKey',
    'baseUrl',
];
/**
 * All provider-sourced fields that need to be tracked for source attribution
 * and cleared when switching from provider to manual credentials.
 */
export const PROVIDER_SOURCED_FIELDS = [
    ...CREDENTIAL_FIELDS,
    ...MODEL_GENERATION_CONFIG_FIELDS,
];
export const AUTH_ENV_MAPPINGS = {
    openai: {
        apiKey: ['OPENAI_API_KEY'],
        baseUrl: ['OPENAI_BASE_URL'],
        model: ['OPENAI_MODEL', 'VIVEKMIND_MODEL'],
    },
    anthropic: {
        apiKey: ['ANTHROPIC_API_KEY'],
        baseUrl: ['ANTHROPIC_BASE_URL'],
        model: ['ANTHROPIC_MODEL'],
    },
    gemini: {
        apiKey: ['GEMINI_API_KEY'],
        baseUrl: [],
        model: ['GEMINI_MODEL'],
    },
    'vertex-ai': {
        apiKey: ['GOOGLE_API_KEY'],
        baseUrl: [],
        model: ['GOOGLE_MODEL'],
    },
    'vivekmind-oauth': {
        apiKey: [],
        baseUrl: [],
        model: [],
    },
    bedrock: {
        apiKey: ['AWS_ACCESS_KEY_ID'],
        baseUrl: [],
        model: ['BEDROCK_MODEL'],
    },
    'azure-openai': {
        apiKey: ['AZURE_OPENAI_API_KEY'],
        baseUrl: ['AZURE_OPENAI_ENDPOINT'],
        model: ['AZURE_OPENAI_MODEL'],
    },
    'anthropic-vertex-ai': {
        apiKey: ['GOOGLE_API_KEY'],
        baseUrl: [],
        model: ['ANTHROPIC_MODEL'],
    },
    mistral: {
        apiKey: ['MISTRAL_API_KEY'],
        baseUrl: ['MISTRAL_BASE_URL'],
        model: ['MISTRAL_MODEL'],
    },
    deepseek: {
        apiKey: ['DEEPSEEK_API_KEY'],
        baseUrl: ['DEEPSEEK_BASE_URL'],
        model: ['DEEPSEEK_MODEL'],
    },
    groq: {
        apiKey: ['GROQ_API_KEY'],
        baseUrl: ['GROQ_BASE_URL'],
        model: ['GROQ_MODEL'],
    },
    together: {
        apiKey: ['TOGETHER_API_KEY'],
        baseUrl: ['TOGETHER_BASE_URL'],
        model: ['TOGETHER_MODEL'],
    },
    openrouter: {
        apiKey: ['OPENROUTER_API_KEY'],
        baseUrl: ['OPENROUTER_BASE_URL'],
        model: ['OPENROUTER_MODEL'],
    },
    xai: {
        apiKey: ['XAI_API_KEY'],
        baseUrl: ['XAI_BASE_URL'],
        model: ['XAI_MODEL'],
    },
    dashscope: {
        apiKey: ['DASHSCOPE_API_KEY'],
        baseUrl: ['DASHSCOPE_BASE_URL'],
        model: ['DASHSCOPE_MODEL'],
    },
    ollama: {
        apiKey: [],
        baseUrl: ['OLLAMA_BASE_URL'],
        model: ['OLLAMA_MODEL'],
    },
    'lm-studio': {
        apiKey: [],
        baseUrl: ['LM_STUDIO_BASE_URL'],
        model: ['LM_STUDIO_MODEL'],
    },
    cohere: {
        apiKey: ['COHERE_API_KEY'],
        baseUrl: ['COHERE_BASE_URL'],
        model: ['COHERE_MODEL'],
    },
    perplexity: {
        apiKey: ['PERPLEXITY_API_KEY'],
        baseUrl: ['PERPLEXITY_BASE_URL'],
        model: ['PERPLEXITY_MODEL'],
    },
    fireworks: {
        apiKey: ['FIREWORKS_API_KEY'],
        baseUrl: ['FIREWORKS_BASE_URL'],
        model: ['FIREWORKS_MODEL'],
    },
    siliconflow: {
        apiKey: ['SILICONFLOW_API_KEY'],
        baseUrl: ['SILICONFLOW_BASE_URL'],
        model: ['SILICONFLOW_MODEL'],
    },
    huggingface: {
        apiKey: ['HF_TOKEN', 'HUGGING_FACE_API_KEY'],
        baseUrl: ['HF_BASE_URL'],
        model: ['HF_MODEL'],
    },
    novita: {
        apiKey: ['NOVITA_API_KEY'],
        baseUrl: ['NOVITA_BASE_URL'],
        model: ['NOVITA_MODEL'],
    },
    watsonx: {
        apiKey: ['WATSONX_APIKEY'],
        baseUrl: ['WATSONX_URL'],
        model: ['WATSONX_MODEL'],
    },
};
export const DEFAULT_MODELS = {
    openai: MAINLINE_CODER_MODEL,
    'vivekmind-oauth': DEFAULT_VIVEKMIND_MODEL,
};
/**
 * Hard-coded VivekMind OAuth models that are always available.
 * These cannot be overridden by user configuration.
 */
export const VIVEKMIND_OAUTH_MODELS = [
    {
        id: 'coder-model',
        name: 'coder-model',
        description: 'VivekMind 3.6 Plus — efficient hybrid model with leading coding performance',
        capabilities: { vision: true },
    },
];
/**
 * Derive allowed models from VIVEKMIND_OAUTH_MODELS for authorization.
 * This ensures single source of truth (SSOT).
 */
export const VIVEKMIND_OAUTH_ALLOWED_MODELS = VIVEKMIND_OAUTH_MODELS.map((model) => model.id);
//# sourceMappingURL=constants.js.map