/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand, } from '@aws-sdk/client-bedrock-runtime';
import { BedrockContentConverter } from './converter.js';
import { getBedrockCost } from './pricing.js';
import { RequestTokenEstimator } from '../../utils/request-tokenizer/index.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import { createDebugLogger } from '../../utils/debugLogger.js';
import { tokenLimit, CAPPED_DEFAULT_MAX_TOKENS, hasExplicitOutputLimit, } from '../tokenLimits.js';
const DUMMY_TOOL = {
    toolSpec: {
        name: 'dummy_tool_prevent_validation_error',
        description: 'A placeholder tool to satisfy AWS Bedrock requirements when conversation history contains tool blocks.',
        inputSchema: {
            json: {
                type: 'object',
                properties: {},
            },
        },
    },
};
const debugLogger = createDebugLogger('BEDROCK');
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
export class BedrockContentGenerator {
    contentGeneratorConfig;
    client;
    converter;
    constructor(contentGeneratorConfig, _cliConfig) {
        this.contentGeneratorConfig = contentGeneratorConfig;
        const region = process.env['AWS_REGION'] ||
            process.env['AWS_DEFAULT_REGION'] ||
            'us-east-1';
        const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
        const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
        const sessionToken = process.env['AWS_SESSION_TOKEN'];
        if (!accessKeyId || !secretAccessKey) {
            throw new Error('AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
        }
        this.client = new BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
                ...(sessionToken ? { sessionToken } : {}),
            },
        });
        this.converter = new BedrockContentConverter(contentGeneratorConfig.model, contentGeneratorConfig.schemaCompliance);
        debugLogger.info(`Bedrock provider initialized: region=${region}, model=${contentGeneratorConfig.model}`);
    }
    async generateContent(request) {
        const modelId = this.contentGeneratorConfig.model;
        const { messages, system } = this.converter.convertGeminiRequestToConverse(request);
        const toolConfig = request.config?.tools
            ? await this.converter.convertGeminiToolsToConverse(request.config.tools)
            : undefined;
        const hasToolUseOrToolResult = messages.some((msg) =>
            msg.content?.some((block) => 'toolUse' in block || 'toolResult' in block)
        );
        const inferenceConfig = this.buildInferenceConfig(request);
        const command = new ConverseCommand({
            modelId,
            messages,
            system,
            toolConfig: toolConfig && toolConfig.tools && toolConfig.tools.length > 0
                ? toolConfig
                : hasToolUseOrToolResult
                    ? { tools: [DUMMY_TOOL] }
                    : undefined,
            inferenceConfig,
        });
        debugLogger.info(`Converse request: model=${modelId}, messages=${messages.length}`);
        const response = await this.client.send(command);
        const geminiResponse = this.converter.convertConverseResponseToGemini(response, modelId);
        // Add cost metadata
        if (geminiResponse.usageMetadata) {
            const cost = getBedrockCost(modelId, geminiResponse.usageMetadata.promptTokenCount || 0, geminiResponse.usageMetadata.candidatesTokenCount || 0);
            if (cost !== undefined) {
                geminiResponse.usageMetadata['cost'] =
                    cost;
            }
        }
        return geminiResponse;
    }
    async generateContentStream(request) {
        const modelId = this.contentGeneratorConfig.model;
        const { messages, system } = this.converter.convertGeminiRequestToConverse(request);
        const toolConfig = request.config?.tools
            ? await this.converter.convertGeminiToolsToConverse(request.config.tools)
            : undefined;
        const hasToolUseOrToolResult = messages.some((msg) =>
            msg.content?.some((block) => 'toolUse' in block || 'toolResult' in block)
        );
        const inferenceConfig = this.buildInferenceConfig(request);
        const command = new ConverseStreamCommand({
            modelId,
            messages,
            system,
            toolConfig: toolConfig && toolConfig.tools && toolConfig.tools.length > 0
                ? toolConfig
                : hasToolUseOrToolResult
                    ? { tools: [DUMMY_TOOL] }
                    : undefined,
            inferenceConfig,
        });
        debugLogger.info(`ConverseStream request: model=${modelId}, messages=${messages.length}`);
        const response = await this.client.send(command);
        if (!response.stream) {
            throw new Error('Bedrock ConverseStream returned no stream');
        }
        return this.processStream(response.stream, modelId);
    }
    async countTokens(request) {
        try {
            const estimator = new RequestTokenEstimator();
            const result = await estimator.calculateTokens(request);
            return { totalTokens: result.totalTokens };
        }
        catch (error) {
            debugLogger.warn('Failed to calculate tokens with tokenizer, falling back to simple method:', error);
            const content = JSON.stringify(request.contents);
            const totalTokens = Math.ceil(content.length / 4);
            return { totalTokens };
        }
    }
    async embedContent(_request) {
        throw new Error('AWS Bedrock Converse API does not support embeddings.');
    }
    useSummarizedThinking() {
        return false;
    }
    // ─── Private Helpers ──────────────────────────────────────────────
    buildInferenceConfig(request) {
        const configSamplingParams = this.contentGeneratorConfig.samplingParams;
        const requestConfig = request.config || {};
        const getParam = (configKey, requestKey) => {
            const configValue = configSamplingParams?.[configKey];
            const requestValue = requestKey
                ? requestConfig[requestKey]
                : undefined;
            return configValue !== undefined ? configValue : requestValue;
        };
        // Apply output token limit logic consistent with other providers
        const userMaxTokens = getParam('max_tokens', 'maxOutputTokens');
        const modelId = this.contentGeneratorConfig.model;
        const modelLimit = tokenLimit(modelId, 'output');
        const isKnownModel = hasExplicitOutputLimit(modelId);
        let maxTokens;
        if (userMaxTokens !== undefined && userMaxTokens !== null) {
            maxTokens = isKnownModel
                ? Math.min(userMaxTokens, modelLimit)
                : userMaxTokens;
        }
        else {
            const envVal = process.env['VIVEKMIND_CODE_MAX_OUTPUT_TOKENS'];
            const envMaxTokens = envVal ? parseInt(envVal, 10) : NaN;
            if (!isNaN(envMaxTokens) && envMaxTokens > 0) {
                maxTokens = isKnownModel
                    ? Math.min(envMaxTokens, modelLimit)
                    : envMaxTokens;
            }
            else {
                maxTokens = Math.min(modelLimit, CAPPED_DEFAULT_MAX_TOKENS);
            }
        }
        return {
            maxTokens,
            temperature: getParam('temperature', 'temperature') ?? 1,
            topP: getParam('top_p', 'topP'),
        };
    }
    async *processStream(stream, model) {
        let promptTokens = 0;
        let completionTokens = 0;
        let finishReason;
        // State for accumulating tool_use blocks
        let currentToolUse;
        for await (const event of stream) {
            // ── messageStart ──────────────────────────────────────────
            if (event.messageStart) {
                // messageStart just confirms the role; no content to yield yet
                continue;
            }
            // ── contentBlockStart ─────────────────────────────────────
            if (event.contentBlockStart) {
                const start = event.contentBlockStart.start;
                if (start?.toolUse) {
                    currentToolUse = {
                        toolUseId: start.toolUse.toolUseId || `tool_${Date.now()}`,
                        name: start.toolUse.name || '',
                        inputJson: '',
                    };
                }
                continue;
            }
            // ── contentBlockDelta ─────────────────────────────────────
            if (event.contentBlockDelta) {
                const delta = event.contentBlockDelta.delta;
                // Text delta
                if (delta?.text) {
                    const chunk = this.converter.buildGeminiStreamChunk({ text: delta.text }, model);
                    yield chunk;
                }
                // Tool use input delta (accumulate JSON fragments)
                if (delta?.toolUse?.input) {
                    if (currentToolUse) {
                        currentToolUse.inputJson += delta.toolUse.input;
                    }
                }
                continue;
            }
            // ── contentBlockStop ──────────────────────────────────────
            if (event.contentBlockStop !== undefined) {
                // If we were accumulating a tool_use block, emit it now
                if (currentToolUse) {
                    const args = safeJsonParse(currentToolUse.inputJson || '{}', {});
                    const chunk = this.converter.buildGeminiStreamChunk({
                        functionCall: {
                            id: currentToolUse.toolUseId,
                            name: currentToolUse.name,
                            args,
                        },
                    }, model);
                    yield chunk;
                    currentToolUse = undefined;
                }
                continue;
            }
            // ── messageStop ───────────────────────────────────────────
            if (event.messageStop) {
                finishReason = event.messageStop.stopReason || finishReason;
                continue;
            }
            // ── metadata (usage, metrics) ─────────────────────────────
            if (event.metadata) {
                if (event.metadata.usage) {
                    promptTokens = event.metadata.usage.inputTokens || 0;
                    completionTokens = event.metadata.usage.outputTokens || 0;
                }
                const cost = getBedrockCost(model, promptTokens, completionTokens);
                const usageMetadata = {
                    promptTokenCount: promptTokens,
                    candidatesTokenCount: completionTokens,
                    totalTokenCount: promptTokens + completionTokens,
                };
                if (cost !== undefined) {
                    usageMetadata['cost'] = cost;
                }
                const chunk = this.converter.buildGeminiStreamChunk(undefined, model, finishReason, usageMetadata);
                yield chunk;
            }
        }
        // If we got a finishReason but no metadata event, yield a final chunk
        // with the finish reason so the pipeline knows the stream ended properly.
        if (finishReason && promptTokens === 0 && completionTokens === 0) {
            const chunk = this.converter.buildGeminiStreamChunk(undefined, model, finishReason);
            yield chunk;
        }
    }
}
//# sourceMappingURL=bedrockContentGenerator.js.map