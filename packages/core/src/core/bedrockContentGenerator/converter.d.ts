/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Converts between VivekMind's internal Gemini-format messages and
 * AWS Bedrock Converse API format.
 */
import type { GenerateContentParameters, ToolListUnion } from '@google/genai';
import { FinishReason, GenerateContentResponse } from '@google/genai';
import type { Message as BedrockMessage, SystemContentBlock, ToolConfiguration } from '@aws-sdk/client-bedrock-runtime';
import type { ContentGeneratorConfig } from '../contentGenerator.js';
export interface ConvertedConverseRequest {
    messages: BedrockMessage[];
    system?: SystemContentBlock[];
    toolConfig?: ToolConfiguration;
}
export declare class BedrockContentConverter {
    private model;
    private schemaCompliance;
    constructor(model: string, schemaCompliance?: ContentGeneratorConfig['schemaCompliance']);
    /**
     * Convert a Gemini-format request to Bedrock Converse API format.
     */
    convertGeminiRequestToConverse(request: GenerateContentParameters): ConvertedConverseRequest;
    /**
     * Convert Gemini tool definitions to Bedrock Converse toolConfig format.
     */
    convertGeminiToolsToConverse(geminiTools: ToolListUnion): Promise<ToolConfiguration>;
    /**
     * Convert a Bedrock Converse (non-streaming) response to Gemini format.
     */
    convertConverseResponseToGemini(response: {
        output?: {
            message?: BedrockMessage;
        };
        stopReason?: string;
        usage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
        };
    }, model: string): GenerateContentResponse;
    /**
     * Build a Gemini-format streaming chunk from Bedrock stream event data.
     */
    buildGeminiStreamChunk(part?: {
        text?: string;
        thought?: boolean;
        functionCall?: {
            id?: string;
            name?: string;
            args?: Record<string, unknown>;
        };
    }, model?: string, finishReason?: string, usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    }): GenerateContentResponse;
    /**
     * Map Bedrock stop reason to Gemini FinishReason.
     */
    mapBedrockStopReasonToGemini(reason?: string | null): FinishReason | undefined;
    private processContents;
    private processContent;
    private createToolResultBlocks;
    private extractFunctionResponseContent;
    private extractTextFromContentUnion;
    /**
     * Ensure messages alternate between user and assistant roles.
     * Converse API requires strict role alternation.
     * Adjacent messages of the same role are merged.
     */
    private ensureAlternatingRoles;
    private mimeToImageFormat;
    private isContentObject;
}
