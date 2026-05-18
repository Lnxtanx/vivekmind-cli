/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Bedrock on-demand pricing per model (USD per 1K tokens).
 * Source: https://aws.amazon.com/bedrock/pricing/
 *
 * Model IDs may include regional prefixes (e.g., "us.anthropic.claude-...").
 * The lookup helper strips the prefix automatically.
 */
export interface BedrockModelPricing {
    inputPer1K: number;
    outputPer1K: number;
}
export declare const BEDROCK_PRICING: Record<string, BedrockModelPricing>;
/**
 * Calculate the estimated cost for a Bedrock API call.
 *
 * @param modelId - The Bedrock model ID (e.g., "anthropic.claude-sonnet-4-20250514-v1:0")
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Estimated cost in USD, or undefined if pricing is unknown
 */
export declare function getBedrockCost(modelId: string, inputTokens: number, outputTokens: number): number | undefined;
