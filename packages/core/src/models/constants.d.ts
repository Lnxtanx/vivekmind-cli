/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType } from '../core/contentGenerator.js';
import type { ModelConfig } from './types.js';
/**
 * Field keys for model-scoped generation config.
 *
 * Kept in a small standalone module to avoid circular deps. The `import('...')`
 * usage is type-only and does not emit runtime imports.
 */
export declare const MODEL_GENERATION_CONFIG_FIELDS: readonly ["samplingParams", "timeout", "maxRetries", "retryErrorCodes", "enableCacheControl", "schemaCompliance", "reasoning", "contextWindowSize", "customHeaders", "extra_body", "modalities", "splitToolMedia"];
/**
 * Credential-related fields that are part of ContentGeneratorConfig
 * but not ModelGenerationConfig.
 */
export declare const CREDENTIAL_FIELDS: readonly ["model", "apiKey", "apiKeyEnvKey", "baseUrl"];
/**
 * All provider-sourced fields that need to be tracked for source attribution
 * and cleared when switching from provider to manual credentials.
 */
export declare const PROVIDER_SOURCED_FIELDS: readonly ["model", "apiKey", "apiKeyEnvKey", "baseUrl", "samplingParams", "timeout", "maxRetries", "retryErrorCodes", "enableCacheControl", "schemaCompliance", "reasoning", "contextWindowSize", "customHeaders", "extra_body", "modalities", "splitToolMedia"];
/**
 * Environment variable mappings per authType.
 */
export interface AuthEnvMapping {
    apiKey: string[];
    baseUrl: string[];
    model: string[];
}
export declare const AUTH_ENV_MAPPINGS: {
    readonly openai: {
        readonly apiKey: ["OPENAI_API_KEY"];
        readonly baseUrl: ["OPENAI_BASE_URL"];
        readonly model: ["OPENAI_MODEL", "VIVEKMIND_MODEL"];
    };
    readonly anthropic: {
        readonly apiKey: ["ANTHROPIC_API_KEY"];
        readonly baseUrl: ["ANTHROPIC_BASE_URL"];
        readonly model: ["ANTHROPIC_MODEL"];
    };
    readonly gemini: {
        readonly apiKey: ["GEMINI_API_KEY"];
        readonly baseUrl: [];
        readonly model: ["GEMINI_MODEL"];
    };
    readonly 'vertex-ai': {
        readonly apiKey: ["GOOGLE_API_KEY"];
        readonly baseUrl: [];
        readonly model: ["GOOGLE_MODEL"];
    };
    readonly 'vivekmind-oauth': {
        readonly apiKey: [];
        readonly baseUrl: [];
        readonly model: [];
    };
    readonly bedrock: {
        readonly apiKey: ["AWS_ACCESS_KEY_ID"];
        readonly baseUrl: [];
        readonly model: ["BEDROCK_MODEL"];
    };
    readonly 'azure-openai': {
        readonly apiKey: ["AZURE_OPENAI_API_KEY"];
        readonly baseUrl: ["AZURE_OPENAI_ENDPOINT"];
        readonly model: ["AZURE_OPENAI_MODEL"];
    };
    readonly 'anthropic-vertex-ai': {
        readonly apiKey: ["GOOGLE_API_KEY"];
        readonly baseUrl: [];
        readonly model: ["ANTHROPIC_MODEL"];
    };
    readonly mistral: {
        readonly apiKey: ["MISTRAL_API_KEY"];
        readonly baseUrl: ["MISTRAL_BASE_URL"];
        readonly model: ["MISTRAL_MODEL"];
    };
    readonly deepseek: {
        readonly apiKey: ["DEEPSEEK_API_KEY"];
        readonly baseUrl: ["DEEPSEEK_BASE_URL"];
        readonly model: ["DEEPSEEK_MODEL"];
    };
    readonly groq: {
        readonly apiKey: ["GROQ_API_KEY"];
        readonly baseUrl: ["GROQ_BASE_URL"];
        readonly model: ["GROQ_MODEL"];
    };
    readonly together: {
        readonly apiKey: ["TOGETHER_API_KEY"];
        readonly baseUrl: ["TOGETHER_BASE_URL"];
        readonly model: ["TOGETHER_MODEL"];
    };
    readonly openrouter: {
        readonly apiKey: ["OPENROUTER_API_KEY"];
        readonly baseUrl: ["OPENROUTER_BASE_URL"];
        readonly model: ["OPENROUTER_MODEL"];
    };
    readonly xai: {
        readonly apiKey: ["XAI_API_KEY"];
        readonly baseUrl: ["XAI_BASE_URL"];
        readonly model: ["XAI_MODEL"];
    };
    readonly dashscope: {
        readonly apiKey: ["DASHSCOPE_API_KEY"];
        readonly baseUrl: ["DASHSCOPE_BASE_URL"];
        readonly model: ["DASHSCOPE_MODEL"];
    };
    readonly ollama: {
        readonly apiKey: [];
        readonly baseUrl: ["OLLAMA_BASE_URL"];
        readonly model: ["OLLAMA_MODEL"];
    };
    readonly 'lm-studio': {
        readonly apiKey: [];
        readonly baseUrl: ["LM_STUDIO_BASE_URL"];
        readonly model: ["LM_STUDIO_MODEL"];
    };
    readonly cohere: {
        readonly apiKey: ["COHERE_API_KEY"];
        readonly baseUrl: ["COHERE_BASE_URL"];
        readonly model: ["COHERE_MODEL"];
    };
    readonly perplexity: {
        readonly apiKey: ["PERPLEXITY_API_KEY"];
        readonly baseUrl: ["PERPLEXITY_BASE_URL"];
        readonly model: ["PERPLEXITY_MODEL"];
    };
    readonly fireworks: {
        readonly apiKey: ["FIREWORKS_API_KEY"];
        readonly baseUrl: ["FIREWORKS_BASE_URL"];
        readonly model: ["FIREWORKS_MODEL"];
    };
    readonly siliconflow: {
        readonly apiKey: ["SILICONFLOW_API_KEY"];
        readonly baseUrl: ["SILICONFLOW_BASE_URL"];
        readonly model: ["SILICONFLOW_MODEL"];
    };
    readonly huggingface: {
        readonly apiKey: ["HF_TOKEN", "HUGGING_FACE_API_KEY"];
        readonly baseUrl: ["HF_BASE_URL"];
        readonly model: ["HF_MODEL"];
    };
    readonly novita: {
        readonly apiKey: ["NOVITA_API_KEY"];
        readonly baseUrl: ["NOVITA_BASE_URL"];
        readonly model: ["NOVITA_MODEL"];
    };
    readonly watsonx: {
        readonly apiKey: ["WATSONX_APIKEY"];
        readonly baseUrl: ["WATSONX_URL"];
        readonly model: ["WATSONX_MODEL"];
    };
};
export declare const DEFAULT_MODELS: Partial<Record<AuthType, string>>;
/**
 * Hard-coded VivekMind OAuth models that are always available.
 * These cannot be overridden by user configuration.
 */
export declare const VIVEKMIND_OAUTH_MODELS: ModelConfig[];
/**
 * Derive allowed models from VIVEKMIND_OAUTH_MODELS for authorization.
 * This ensures single source of truth (SSOT).
 */
export declare const VIVEKMIND_OAUTH_ALLOWED_MODELS: readonly string[];
