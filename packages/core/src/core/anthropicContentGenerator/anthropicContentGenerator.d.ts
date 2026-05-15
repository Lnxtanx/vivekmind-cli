/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CountTokensParameters, CountTokensResponse, EmbedContentParameters, EmbedContentResponse, GenerateContentParameters } from '@google/genai';
import { GenerateContentResponse } from '@google/genai';
import type { Config } from '../../config/config.js';
import type { ContentGenerator, ContentGeneratorConfig } from '../contentGenerator.js';
export declare class AnthropicContentGenerator implements ContentGenerator {
    private contentGeneratorConfig;
    private readonly cliConfig;
    private client;
    private converter;
    private effortClampWarned;
    constructor(contentGeneratorConfig: ContentGeneratorConfig, cliConfig: Config);
    generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse>;
    generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>>;
    countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;
    embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse>;
    useSummarizedThinking(): boolean;
    private buildHeaders;
    /**
     * Compute `anthropic-beta` from the actual fields present in the request
     * body. Keeps the header consistent with the body even when a per-request
     * `thinkingConfig.includeThoughts: false` opt-out drops `thinking` /
     * `output_config` after the constructor has already run.
     *
     * User-supplied `customHeaders['anthropic-beta']` flags are merged in (and
     * deduped) so the per-request override doesn't wipe out the existing
     * customHeaders escape hatch for unrelated beta features. The lookup is
     * case-insensitive — HTTP header names are case-insensitive by spec, so a
     * user-configured `Anthropic-Beta` or `ANTHROPIC-BETA` is honored too.
     */
    private buildPerRequestHeaders;
    /**
     * Read every customHeaders entry whose key (case-insensitively) is
     * `anthropic-beta` and yield the comma-separated flags from each. Multiple
     * matching entries are concatenated; later ones may produce duplicates
     * which the caller dedupes.
     */
    private collectCustomBetaFlags;
    private buildRequest;
    private buildSamplingParameters;
    /**
     * Compute the effort value that both the thinking budget ladder and
     * output_config should use for this request. Returns undefined whenever
     * reasoning is disabled or the user didn't set an effort. Clamps the
     * DeepSeek-only 'max' tier to 'high' when the resolved baseURL is NOT a
     * DeepSeek hostname (real Anthropic accepts low/medium/high only and
     * would 400 on 'max'). Uses the hostname-only detector deliberately —
     * the broader `isDeepSeekAnthropicProvider` model-name fallback exists
     * for the thinking-block injection workaround (sglang/vllm self-hosted
     * coverage), but trusting it here would let a model named e.g.
     * "deepseek-clone" running on real api.anthropic.com bypass the clamp.
     *
     * The downgrade warning fires once per generator lifetime via the
     * `effortClampWarned` latch — repeating on every request just spams
     * the log without giving users new information.
     */
    private resolveEffectiveEffort;
    private buildThinkingConfig;
    private buildOutputConfig;
    private processStream;
    private buildGeminiChunk;
}
