/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts between VivekMind's internal Gemini-format messages and
 * AWS Bedrock Converse API format.
 */

import type {
  CallableTool,
  Content,
  ContentListUnion,
  ContentUnion,
  FunctionResponse,
  GenerateContentParameters,
  Part,
  PartUnion,
  Tool,
  ToolListUnion,
} from '@google/genai';
import { FinishReason, GenerateContentResponse } from '@google/genai';
import type {
  ContentBlock as BedrockContentBlock,
  ConversationRole,
  Message as BedrockMessage,
  SystemContentBlock,
  ToolConfiguration,
  ToolInputSchema,
  ToolResultContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { convertSchema } from '../../utils/schemaConverter.js';
import { createDebugLogger } from '../../utils/debugLogger.js';
import { defaultModalities } from '../modalityDefaults.js';
import type { ContentGeneratorConfig, InputModalities } from '../contentGenerator.js';

const debugLogger = createDebugLogger('BEDROCK_CONVERTER');

export interface ConvertedConverseRequest {
  messages: BedrockMessage[];
  system?: SystemContentBlock[];
  toolConfig?: ToolConfiguration;
}

export class BedrockContentConverter {
  private model: string;
  private schemaCompliance: ContentGeneratorConfig['schemaCompliance'];
  private modalities: InputModalities;

  constructor(
    model: string,
    schemaCompliance: ContentGeneratorConfig['schemaCompliance'] = 'auto',
  ) {
    this.model = model;
    this.schemaCompliance = schemaCompliance;
    this.modalities = defaultModalities(model);
    debugLogger.info(
      `Modalities for ${model}: ${JSON.stringify(this.modalities)}`,
    );
  }

  /**
   * Convert a Gemini-format request to Bedrock Converse API format.
   */
  convertGeminiRequestToConverse(
    request: GenerateContentParameters,
  ): ConvertedConverseRequest {
    const messages: BedrockMessage[] = [];

    // Extract system prompt
    const systemText = this.extractTextFromContentUnion(
      request.config?.systemInstruction,
    );
    const system: SystemContentBlock[] | undefined = systemText
      ? [{ text: systemText }]
      : undefined;

    // Convert conversation messages
    this.processContents(request.contents, messages);

    // Ensure messages alternate user/assistant (Converse API requirement)
    this.ensureAlternatingRoles(messages);

    return { messages, system };
  }

  /**
   * Convert Gemini tool definitions to Bedrock Converse toolConfig format.
   */
  async convertGeminiToolsToConverse(
    geminiTools: ToolListUnion,
  ): Promise<ToolConfiguration> {
    const tools: Array<{
      toolSpec: {
        name: string;
        description: string;
        inputSchema: ToolInputSchema;
      };
    }> = [];

    for (const tool of geminiTools) {
      let actualTool: Tool;

      if ('tool' in tool) {
        actualTool = await (tool as CallableTool).tool();
      } else {
        actualTool = tool as Tool;
      }

      if (!actualTool.functionDeclarations) {
        continue;
      }

      for (const func of actualTool.functionDeclarations) {
        if (!func.name || !func.description) continue;

        let inputSchema: Record<string, unknown> | undefined;
        if (func.parametersJsonSchema) {
          inputSchema = {
            ...(func.parametersJsonSchema as Record<string, unknown>),
          };
        } else if (func.parameters) {
          inputSchema = func.parameters as Record<string, unknown>;
        }

        if (!inputSchema) {
          inputSchema = { type: 'object', properties: {} };
        }

        inputSchema = convertSchema(inputSchema, this.schemaCompliance);
        if (typeof inputSchema['type'] !== 'string') {
          inputSchema['type'] = 'object';
        }

        tools.push({
          toolSpec: {
            name: func.name,
            description: func.description,
            inputSchema: { json: inputSchema } as ToolInputSchema,
          },
        });
      }
    }

    return { tools };
  }

  /**
   * Convert a Bedrock Converse (non-streaming) response to Gemini format.
   */
  convertConverseResponseToGemini(
    response: {
      output?: { message?: BedrockMessage };
      stopReason?: string;
      usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    },
    model: string,
  ): GenerateContentResponse {
    const geminiResponse = new GenerateContentResponse();
    const parts: Part[] = [];

    const message = response.output?.message;
    if (message?.content) {
      for (const block of message.content) {
        if (block.text) {
          parts.push({ text: block.text });
        }
        if (block.toolUse) {
          parts.push({
            functionCall: {
              id: block.toolUse.toolUseId,
              name: block.toolUse.name,
              args: (block.toolUse.input as Record<string, unknown>) || {},
            },
          });
        }
      }
    }

    const finishReason = this.mapBedrockStopReasonToGemini(
      response.stopReason,
    );

    geminiResponse.candidates = [
      {
        content: {
          parts,
          role: 'model' as const,
        },
        index: 0,
        safetyRatings: [],
        ...(finishReason ? { finishReason } : {}),
      },
    ];

    geminiResponse.createTime = Date.now().toString();
    geminiResponse.modelVersion = model;
    geminiResponse.promptFeedback = { safetyRatings: [] };

    if (response.usage) {
      const inputTokens = response.usage.inputTokens || 0;
      const outputTokens = response.usage.outputTokens || 0;
      geminiResponse.usageMetadata = {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
        totalTokenCount: inputTokens + outputTokens,
      };
    }

    return geminiResponse;
  }

  /**
   * Build a Gemini-format streaming chunk from Bedrock stream event data.
   */
  buildGeminiStreamChunk(
    part?: {
      text?: string;
      thought?: boolean;
      functionCall?: {
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      };
    },
    model?: string,
    finishReason?: string,
    usageMetadata?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    },
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    response.createTime = Date.now().toString();
    response.modelVersion = model || this.model;
    response.promptFeedback = { safetyRatings: [] };

    const candidateParts: Part[] = part ? [part as unknown as Part] : [];
    const mappedFinishReason =
      finishReason !== undefined
        ? this.mapBedrockStopReasonToGemini(finishReason)
        : undefined;

    response.candidates = [
      {
        content: {
          parts: candidateParts,
          role: 'model' as const,
        },
        index: 0,
        safetyRatings: [],
        ...(mappedFinishReason ? { finishReason: mappedFinishReason } : {}),
      },
    ];

    if (usageMetadata) {
      response.usageMetadata = usageMetadata;
    }

    return response;
  }

  /**
   * Map Bedrock stop reason to Gemini FinishReason.
   */
  mapBedrockStopReasonToGemini(
    reason?: string | null,
  ): FinishReason | undefined {
    if (!reason) return undefined;
    const mapping: Record<string, FinishReason> = {
      end_turn: FinishReason.STOP,
      stop_sequence: FinishReason.STOP,
      tool_use: FinishReason.STOP,
      max_tokens: FinishReason.MAX_TOKENS,
      content_filtered: FinishReason.SAFETY,
      guardrail_intervened: FinishReason.SAFETY,
    };
    return mapping[reason] || FinishReason.FINISH_REASON_UNSPECIFIED;
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private processContents(
    contents: ContentListUnion,
    messages: BedrockMessage[],
  ): void {
    if (Array.isArray(contents)) {
      for (const content of contents) {
        this.processContent(content, messages);
      }
    } else if (contents) {
      this.processContent(contents, messages);
    }
  }

  private processContent(
    content: ContentUnion | PartUnion,
    messages: BedrockMessage[],
  ): void {
    if (typeof content === 'string') {
      messages.push({
        role: 'user' as ConversationRole,
        content: [{ text: content }],
      });
      return;
    }

    if (!this.isContentObject(content)) return;

    const parts = content.parts || [];
    const role: ConversationRole =
      content.role === 'model'
        ? ('assistant' as ConversationRole)
        : ('user' as ConversationRole);

    const contentBlocks: BedrockContentBlock[] = [];

    for (const part of parts) {
      if (typeof part === 'string') {
        contentBlocks.push({ text: part });
        continue;
      }

      // Skip thinking/thought parts — Converse API doesn't support them
      if ('thought' in part && part.thought) {
        continue;
      }

      // Text content
      if ('text' in part && part.text) {
        contentBlocks.push({ text: part.text });
      }

      // Image content
      if (part.inlineData?.mimeType && part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType;
        const displayName = part.inlineData.displayName || mimeType;

        if (!this.modalities.image) {
          // Model doesn't support images — insert text placeholder
          // instead of sending an image block that would cause an API error.
          debugLogger.warn(
            `Model '${this.model}' does not support image input. ` +
              `Replacing with text placeholder: ${displayName}`,
          );
          contentBlocks.push({
            text: `[Unsupported image: ${displayName}. This model does not support image input.]`,
          });
        } else {
          const format = this.mimeToImageFormat(mimeType);
          if (format) {
            contentBlocks.push({
              image: {
                format,
                source: {
                  bytes: Buffer.from(part.inlineData.data, 'base64'),
                },
              },
            });
          } else {
            // Image format not supported by Bedrock (e.g., BMP, TIFF, HEIC)
            debugLogger.warn(
              `Image format '${mimeType}' is not supported by Bedrock Converse API. ` +
                `Replacing with text placeholder: ${displayName}`,
            );
            contentBlocks.push({
              text: `[Unsupported image format: ${mimeType} (${displayName}). Bedrock supports JPEG, PNG, GIF, and WebP.]`,
            });
          }
        }
      }

      // Function call (assistant → toolUse)
      if ('functionCall' in part && part.functionCall && role === 'assistant') {
        contentBlocks.push({
          toolUse: {
            toolUseId: part.functionCall.id || `tool_${Date.now()}`,
            name: part.functionCall.name || '',
            input: ((part.functionCall.args as Record<string, unknown>) || {}) as any,
          },
        });
      }

      // Function response (user → toolResult)
      if (part.functionResponse && role === 'user') {
        const toolResultBlocks = this.createToolResultBlocks(
          part.functionResponse,
        );
        contentBlocks.push({
          toolResult: {
            toolUseId: part.functionResponse.id || '',
            content: toolResultBlocks,
          },
        });
      }
    }

    if (contentBlocks.length > 0) {
      messages.push({ role, content: contentBlocks });
    }
  }

  private createToolResultBlocks(
    response: FunctionResponse,
  ): ToolResultContentBlock[] {
    const blocks: ToolResultContentBlock[] = [];

    const textContent = this.extractFunctionResponseContent(response.response);
    if (textContent) {
      blocks.push({ text: textContent });
    }

    // Forward image content from tool responses when model supports vision
    const responseData = response.response;
    if (this.modalities.image && responseData && typeof responseData === 'object') {
      const dataObj = responseData as Record<string, unknown>;
      // Handle nested inlineData in tool response objects
      const inlineDataVal = dataObj['inlineData'];
      if (inlineDataVal && typeof inlineDataVal === 'object') {
        const inlineData = inlineDataVal as { mimeType?: string; data?: string };
        if (inlineData.mimeType && inlineData.data) {
          const format = this.mimeToImageFormat(inlineData.mimeType);
          if (format) {
            blocks.push({
              image: {
                format,
                source: { bytes: Buffer.from(inlineData.data, 'base64') },
              },
            });
          }
        }
      }
    }

    return blocks.length > 0 ? blocks : [{ text: '' }];
  }

  private extractFunctionResponseContent(response: unknown): string {
    if (response === null || response === undefined) return '';
    if (typeof response === 'string') return response;

    if (typeof response === 'object') {
      const responseObject = response as Record<string, unknown>;
      const output = responseObject['output'];
      if (typeof output === 'string') return output;
      const error = responseObject['error'];
      if (typeof error === 'string') return error;
    }

    try {
      return JSON.stringify(response) ?? String(response);
    } catch {
      return String(response);
    }
  }

  private extractTextFromContentUnion(contentUnion: unknown): string {
    if (typeof contentUnion === 'string') return contentUnion;

    if (Array.isArray(contentUnion)) {
      return contentUnion
        .map((item) => this.extractTextFromContentUnion(item))
        .filter(Boolean)
        .join('\n');
    }

    if (typeof contentUnion === 'object' && contentUnion !== null) {
      if ('parts' in contentUnion) {
        const content = contentUnion as Content;
        return (
          content.parts
            ?.map((part: Part) => {
              if (typeof part === 'string') return part;
              if ('text' in part) return part.text || '';
              return '';
            })
            .filter(Boolean)
            .join('\n') || ''
        );
      }
    }

    return '';
  }

  /**
   * Ensure messages alternate between user and assistant roles.
   * Converse API requires strict role alternation.
   * Adjacent messages of the same role are merged.
   */
  private ensureAlternatingRoles(messages: BedrockMessage[]): void {
    let i = 0;
    while (i < messages.length - 1) {
      if (messages[i].role === messages[i + 1].role) {
        // Merge content of next message into current
        const current = messages[i].content || [];
        const next = messages[i + 1].content || [];
        messages[i].content = [...current, ...next];
        messages.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }

  private mimeToImageFormat(
    mimeType: string,
  ): 'jpeg' | 'png' | 'gif' | 'webp' | undefined {
    const mapping: Record<string, 'jpeg' | 'png' | 'gif' | 'webp'> = {
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpeg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return mapping[mimeType];
  }

  private isContentObject(
    content: unknown,
  ): content is { role: string; parts: Part[] } {
    return (
      typeof content === 'object' &&
      content !== null &&
      'role' in content &&
      'parts' in content &&
      Array.isArray((content as Record<string, unknown>)['parts'])
    );
  }
}
