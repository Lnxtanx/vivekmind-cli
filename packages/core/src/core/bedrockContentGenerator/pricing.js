/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
export const BEDROCK_PRICING = {
    // Anthropic Claude
    'anthropic.claude-sonnet-4-20250514-v1:0': {
        inputPer1K: 0.003,
        outputPer1K: 0.015,
    },
    'anthropic.claude-haiku-3-5-20241022-v1:0': {
        inputPer1K: 0.0008,
        outputPer1K: 0.004,
    },
    'anthropic.claude-3-5-sonnet-20241022-v2:0': {
        inputPer1K: 0.003,
        outputPer1K: 0.015,
    },
    'anthropic.claude-3-5-sonnet-20240620-v1:0': {
        inputPer1K: 0.003,
        outputPer1K: 0.015,
    },
    'anthropic.claude-3-opus-20240229-v1:0': {
        inputPer1K: 0.015,
        outputPer1K: 0.075,
    },
    'anthropic.claude-3-haiku-20240307-v1:0': {
        inputPer1K: 0.00025,
        outputPer1K: 0.00125,
    },
    // Meta Llama
    'meta.llama3-3-70b-instruct-v1:0': {
        inputPer1K: 0.00072,
        outputPer1K: 0.00072,
    },
    'meta.llama3-2-90b-instruct-v1:0': {
        inputPer1K: 0.002,
        outputPer1K: 0.002,
    },
    'meta.llama3-2-11b-instruct-v1:0': {
        inputPer1K: 0.00016,
        outputPer1K: 0.00016,
    },
    'meta.llama3-1-405b-instruct-v1:0': {
        inputPer1K: 0.00532,
        outputPer1K: 0.016,
    },
    'meta.llama3-1-70b-instruct-v1:0': {
        inputPer1K: 0.00072,
        outputPer1K: 0.00072,
    },
    // Mistral
    'mistral.mistral-large-2407-v1:0': {
        inputPer1K: 0.004,
        outputPer1K: 0.012,
    },
    'mistral.mistral-small-2402-v1:0': {
        inputPer1K: 0.001,
        outputPer1K: 0.003,
    },
    // Cohere
    'cohere.command-r-plus-v1:0': {
        inputPer1K: 0.003,
        outputPer1K: 0.015,
    },
    'cohere.command-r-v1:0': {
        inputPer1K: 0.0005,
        outputPer1K: 0.0015,
    },
    // Amazon Titan
    'amazon.titan-text-premier-v1:0': {
        inputPer1K: 0.0005,
        outputPer1K: 0.0015,
    },
    'amazon.titan-text-express-v1': {
        inputPer1K: 0.0002,
        outputPer1K: 0.0006,
    },
    // DeepSeek
    'deepseek.v3.2': { inputPer1K: 0.00014, outputPer1K: 0.00028 },
    'deepseek.r1-v1:0': { inputPer1K: 0.00055, outputPer1K: 0.00219 },
    // VivekMind
    'vivekmind.vivekmind3-coder-next': { inputPer1K: 0.0003, outputPer1K: 0.001 },
    'vivekmind.vivekmind3-next-80b-a3b': { inputPer1K: 0.0005, outputPer1K: 0.0015 },
    'vivekmind.vivekmind3-32b-v1:0': { inputPer1K: 0.00015, outputPer1K: 0.00045 },
    'vivekmind.vivekmind3-vl-235b-a22b': { inputPer1K: 0.001, outputPer1K: 0.003 },
    'vivekmind.vivekmind3-coder-30b-a3b-v1:0': { inputPer1K: 0.00015, outputPer1K: 0.00045 },
    // Z.AI (GLM)
    'zai.glm-4.7-flash': { inputPer1K: 0.00005, outputPer1K: 0.00005 },
    'zai.glm-5': { inputPer1K: 0.001, outputPer1K: 0.003 },
    'zai.glm-4.7': { inputPer1K: 0.0005, outputPer1K: 0.0015 },
};
/**
 * Calculate the estimated cost for a Bedrock API call.
 *
 * @param modelId - The Bedrock model ID (e.g., "anthropic.claude-sonnet-4-20250514-v1:0")
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Estimated cost in USD, or undefined if pricing is unknown
 */
export function getBedrockCost(modelId, inputTokens, outputTokens) {
    // Try exact match first, then strip regional prefix (e.g., "us." or "eu.")
    const pricing = BEDROCK_PRICING[modelId] ||
        BEDROCK_PRICING[modelId.replace(/^[a-z]{2}\./, '')];
    if (!pricing) {
        return undefined;
    }
    return ((inputTokens / 1000) * pricing.inputPer1K +
        (outputTokens / 1000) * pricing.outputPer1K);
}
//# sourceMappingURL=pricing.js.map