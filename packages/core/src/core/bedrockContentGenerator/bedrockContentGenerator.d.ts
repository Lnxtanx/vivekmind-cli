/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CountTokensParameters, CountTokensResponse, EmbedContentParameters, EmbedContentResponse, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import type { ContentGenerator, ContentGeneratorConfig } from '../contentGenerator.js';
import type { Config } from '../../config/config.js';
/**
 * ContentGenerator implementation for AWS Bedrock using the Converse API.
 *
 * Supports all models available via ConverseStream: Claude, Llama 3.x,
 * Mistral, Cohere Command R, Amazon Titan, and others.
 *
 * Authentication uses standard AWS credentials from environment variables:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION (or AWS_DEFAULT_REGION, defaults to us-east-1)
 * - AWS_SESSION_TOKEN (optional, for STS/SSO)
 */
export declare class BedrockContentGenerator implements ContentGenerator {
    private contentGeneratorConfig;
    private client;
    private converter;
    constructor(contentGeneratorConfig: ContentGeneratorConfig, _cliConfig: Config);
    generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse>;
    generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>>;
    countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;
    embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse>;
    useSummarizedThinking(): boolean;
    private buildInferenceConfig;
    private processStream;
}
