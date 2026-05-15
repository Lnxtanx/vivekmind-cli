/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  ConverseStreamOutput,
  ContentBlock as BedrockContentBlock,
  Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type {
  ContentGenerator,
  ContentGeneratorConfig,
} from '../contentGenerator.js';
import type { Config } from '../../config/config.js';
import { BedrockContentConverter } from './converter.js';
import { getBedrockCost } from './pricing.js';
import { RequestTokenEstimator } from '../../utils/request-tokenizer/index.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import { createDebugLogger } from '../../utils/debugLogger.js';
import {
  tokenLimit,
  CAPPED_DEFAULT_MAX_TOKENS,
  hasExplicitOutputLimit,
} from '../tokenLimits.js';

const debugLogger = createDebugLogger('BEDROCK');

/**
 * Track state while assembling tool_use blocks from stream deltas.
 */
interface StreamingToolUseState {
  toolUseId: string;
  name: string;
  inputJson: string;
}

/**
 * Check whether any message in the list contains toolUse or toolResult
 * content blocks.  The Bedrock Converse API requires `toolConfig` to be
 * present whenever the message history references tools.
 */
function messagesContainToolBlocks(
  messages: BedrockMessage[],
): boolean {
  for (const msg of messages) {
    for (const block of msg.content ?? []) {
      if (block.toolUse || block.toolResult) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Replace toolUse / toolResult content blocks with equivalent text so
 * the Bedrock Converse API does not reject requests that lack a
 * `toolConfig`.
 *
 * - `toolUse` → `[Called tool: name(args)]`
 * - `toolResult` → the text content of the result (preserves useful
 *   context such as file contents and command output).
 */
function stripToolBlocksFromMessages(
  messages: BedrockMessage[],
): BedrockMessage[] {
  return messages.map((msg) => {
    const newContent: BedrockContentBlock[] = [];

    for (const block of msg.content ?? []) {
      if (block.toolUse) {
        const name = block.toolUse.name || 'unknown';
        const input = JSON.stringify(block.toolUse.input ?? {});
        newContent.push({
          text: `[Called tool: ${name}(${input})]`,
        });
      } else if (block.toolResult) {
        const resultParts = block.toolResult.content ?? [];
        const textParts = resultParts
          .filter((b) => 'text' in b && b.text)
          .map((b) => (b as { text: string }).text);
        newContent.push({
          text: textParts.length > 0 ? textParts.join('\n') : '[Tool result: empty]',
        });
      } else {
        newContent.push(block);
      }
    }

    // Guarantee at least one content block per message
    if (newContent.length === 0) {
      newContent.push({ text: '' });
    }

    return { ...msg, content: newContent };
  });
}

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
export class BedrockContentGenerator implements ContentGenerator {
  private client: BedrockRuntimeClient;
  private converter: BedrockContentConverter;

  constructor(
    private contentGeneratorConfig: ContentGeneratorConfig,
    _cliConfig: Config,
  ) {
    const region =
      process.env['AWS_REGION'] ||
      process.env['AWS_DEFAULT_REGION'] ||
      'us-east-1';

    const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
    const sessionToken = process.env['AWS_SESSION_TOKEN'];

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.',
      );
    }

    this.client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });

    this.converter = new BedrockContentConverter(
      contentGeneratorConfig.model,
      contentGeneratorConfig.schemaCompliance,
    );

    debugLogger.info(`Bedrock provider initialized: region=${region}, model=${contentGeneratorConfig.model}`);
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const modelId = this.contentGeneratorConfig.model;
    const { messages, system } =
      this.converter.convertGeminiRequestToConverse(request);

    let toolConfig =
      request.config?.tools
        ? await this.converter.convertGeminiToolsToConverse(
            request.config.tools,
          )
        : undefined;

    // Normalise: empty tools array → undefined
    if (toolConfig && (!toolConfig.tools || toolConfig.tools.length === 0)) {
      toolConfig = undefined;
    }

    const inferenceConfig = this.buildInferenceConfig(request);

    // Bedrock requires toolConfig whenever messages contain toolUse /
    // toolResult blocks.  If tools are not available (e.g. the
    // compression service calls generateContent without tools) we must
    // strip those blocks from the message history to avoid an API error.
    let finalMessages = messages;
    if (!toolConfig && messagesContainToolBlocks(messages)) {
      debugLogger.warn(
        'Messages contain toolUse/toolResult blocks but no toolConfig is available. ' +
          'Stripping tool blocks to avoid Bedrock API rejection.',
      );
      finalMessages = stripToolBlocksFromMessages(messages);
    }

    const command = new ConverseCommand({
      modelId,
      messages: finalMessages,
      system,
      toolConfig: toolConfig ?? undefined,
      inferenceConfig,
    });

    debugLogger.info(`Converse request: model=${modelId}, messages=${finalMessages.length}`);

    const response = await this.client.send(command);

    const geminiResponse = this.converter.convertConverseResponseToGemini(
      response,
      modelId,
    );

    // Add cost metadata
    if (geminiResponse.usageMetadata) {
      const cost = getBedrockCost(
        modelId,
        geminiResponse.usageMetadata.promptTokenCount || 0,
        geminiResponse.usageMetadata.candidatesTokenCount || 0,
      );
      if (cost !== undefined) {
        (geminiResponse.usageMetadata as Record<string, unknown>)['cost'] =
          cost;
      }
    }

    return geminiResponse;
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const modelId = this.contentGeneratorConfig.model;
    const { messages, system } =
      this.converter.convertGeminiRequestToConverse(request);

    let toolConfig =
      request.config?.tools
        ? await this.converter.convertGeminiToolsToConverse(
            request.config.tools,
          )
        : undefined;

    // Normalise: empty tools array → undefined
    if (toolConfig && (!toolConfig.tools || toolConfig.tools.length === 0)) {
      toolConfig = undefined;
    }

    const inferenceConfig = this.buildInferenceConfig(request);

    // Bedrock requires toolConfig whenever messages contain toolUse /
    // toolResult blocks.  If tools are not available (e.g. the
    // compression service calls generateContent without tools) we must
    // strip those blocks from the message history to avoid an API error.
    let finalMessages = messages;
    if (!toolConfig && messagesContainToolBlocks(messages)) {
      debugLogger.warn(
        'Messages contain toolUse/toolResult blocks but no toolConfig is available. ' +
          'Stripping tool blocks to avoid Bedrock API rejection.',
      );
      finalMessages = stripToolBlocksFromMessages(messages);
    }

    const command = new ConverseStreamCommand({
      modelId,
      messages: finalMessages,
      system,
      toolConfig: toolConfig ?? undefined,
      inferenceConfig,
    });

    debugLogger.info(`ConverseStream request: model=${modelId}, messages=${finalMessages.length}`);

    const response = await this.client.send(command);

    if (!response.stream) {
      throw new Error('Bedrock ConverseStream returned no stream');
    }

    return this.processStream(response.stream, modelId);
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    try {
      const estimator = new RequestTokenEstimator();
      const result = await estimator.calculateTokens(request);
      return { totalTokens: result.totalTokens };
    } catch (error) {
      debugLogger.warn(
        'Failed to calculate tokens with tokenizer, falling back to simple method:',
        error,
      );
      const content = JSON.stringify(request.contents);
      const totalTokens = Math.ceil(content.length / 4);
      return { totalTokens };
    }
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('AWS Bedrock Converse API does not support embeddings.');
  }

  useSummarizedThinking(): boolean {
    return false;
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private buildInferenceConfig(
    request: GenerateContentParameters,
  ): {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } {
    const configSamplingParams = this.contentGeneratorConfig.samplingParams;
    const requestConfig = request.config || {};

    const getParam = <T>(
      configKey: keyof NonNullable<typeof configSamplingParams>,
      requestKey?: keyof NonNullable<typeof requestConfig>,
    ): T | undefined => {
      const configValue = configSamplingParams?.[configKey] as T | undefined;
      const requestValue = requestKey
        ? (requestConfig[requestKey] as T | undefined)
        : undefined;
      return configValue !== undefined ? configValue : requestValue;
    };

    // Apply output token limit logic consistent with other providers
    const userMaxTokens = getParam<number>('max_tokens', 'maxOutputTokens');
    const modelId = this.contentGeneratorConfig.model;
    const modelLimit = tokenLimit(modelId, 'output');
    const isKnownModel = hasExplicitOutputLimit(modelId);

    let maxTokens: number;
    if (userMaxTokens !== undefined && userMaxTokens !== null) {
      maxTokens = isKnownModel
        ? Math.min(userMaxTokens, modelLimit)
        : userMaxTokens;
    } else {
      const envVal = process.env['VIVEKMIND_CODE_MAX_OUTPUT_TOKENS'];
      const envMaxTokens = envVal ? parseInt(envVal, 10) : NaN;
      if (!isNaN(envMaxTokens) && envMaxTokens > 0) {
        maxTokens = isKnownModel
          ? Math.min(envMaxTokens, modelLimit)
          : envMaxTokens;
      } else {
        maxTokens = Math.min(modelLimit, CAPPED_DEFAULT_MAX_TOKENS);
      }
    }

    return {
      maxTokens,
      temperature: getParam<number>('temperature', 'temperature') ?? 1,
      topP: getParam<number>('top_p', 'topP'),
    };
  }

  private async *processStream(
    stream: AsyncIterable<ConverseStreamOutput>,
    model: string,
  ): AsyncGenerator<GenerateContentResponse> {
    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason: string | undefined;

    // State for accumulating tool_use blocks
    let currentToolUse: StreamingToolUseState | undefined;

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
          const chunk = this.converter.buildGeminiStreamChunk(
            { text: delta.text },
            model,
          );
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
          const chunk = this.converter.buildGeminiStreamChunk(
            {
              functionCall: {
                id: currentToolUse.toolUseId,
                name: currentToolUse.name,
                args,
              },
            },
            model,
          );
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
        const usageMetadata: Record<string, unknown> = {
          promptTokenCount: promptTokens,
          candidatesTokenCount: completionTokens,
          totalTokenCount: promptTokens + completionTokens,
        };
        if (cost !== undefined) {
          usageMetadata['cost'] = cost;
        }

        const chunk = this.converter.buildGeminiStreamChunk(
          undefined,
          model,
          finishReason,
          usageMetadata as {
            promptTokenCount: number;
            candidatesTokenCount: number;
            totalTokenCount: number;
          },
        );
        yield chunk;
      }
    }

    // If we got a finishReason but no metadata event, yield a final chunk
    // with the finish reason so the pipeline knows the stream ended properly.
    if (finishReason && promptTokens === 0 && completionTokens === 0) {
      const chunk = this.converter.buildGeminiStreamChunk(
        undefined,
        model,
        finishReason,
      );
      yield chunk;
    }
  }
}
