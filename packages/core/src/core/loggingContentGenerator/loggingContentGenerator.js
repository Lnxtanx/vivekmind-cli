/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { GenerateContentResponse, } from '@google/genai';
import { ApiRequestEvent, ApiResponseEvent, ApiErrorEvent, } from '../../telemetry/types.js';
import { logApiError, logApiRequest, logApiResponse, } from '../../telemetry/loggers.js';
import { isInternalPromptId } from '../../utils/internalPromptIds.js';
import { subagentNameContext } from '../../utils/subagentNameContext.js';
import { OpenAIContentConverter } from '../openaiContentGenerator/converter.js';
import { OpenAILogger } from '../../utils/openaiLogger.js';
import { getErrorMessage, getErrorStatus, getErrorType, } from '../../utils/errors.js';
/**
 * A decorator that wraps a ContentGenerator to add logging to API calls.
 */
export class LoggingContentGenerator {
    wrapped;
    config;
    openaiLogger;
    schemaCompliance;
    modalities;
    constructor(wrapped, config, generatorConfig) {
        this.wrapped = wrapped;
        this.config = config;
        this.modalities = generatorConfig.modalities;
        // Extract fields needed for initialization from passed config
        // (config.getContentGeneratorConfig() may not be available yet during refreshAuth)
        if (generatorConfig.enableOpenAILogging) {
            this.openaiLogger = new OpenAILogger(generatorConfig.openAILoggingDir, config.getWorkingDir());
            this.schemaCompliance = generatorConfig.schemaCompliance;
        }
    }
    getWrapped() {
        return this.wrapped;
    }
    logApiRequest(contents, model, promptId) {
        const requestText = JSON.stringify(contents);
        logApiRequest(this.config, new ApiRequestEvent(model, promptId, requestText, subagentNameContext.getStore()));
    }
    _logApiResponse(responseId, durationMs, model, prompt_id, usageMetadata, responseText) {
        logApiResponse(this.config, new ApiResponseEvent(responseId, model, durationMs, prompt_id, this.config.getAuthType(), usageMetadata, responseText, subagentNameContext.getStore()));
    }
    _logApiError(responseId, durationMs, error, model, prompt_id) {
        const errorMessage = getErrorMessage(error);
        const errorType = getErrorType(error);
        const errorResponseId = error?.requestID ||
            error?.request_id ||
            responseId;
        const errorStatus = getErrorStatus(error);
        logApiError(this.config, new ApiErrorEvent({
            responseId: errorResponseId,
            model,
            durationMs,
            promptId: prompt_id,
            authType: this.config.getAuthType(),
            errorMessage,
            errorType,
            statusCode: errorStatus,
            subagentName: subagentNameContext.getStore(),
        }));
    }
    async generateContent(req, userPromptId) {
        const startTime = Date.now();
        const isInternal = isInternalPromptId(userPromptId);
        if (!isInternal) {
            this.logApiRequest(this.toContents(req.contents), req.model, userPromptId);
        }
        const openaiRequest = isInternal
            ? undefined
            : await this.buildOpenAIRequestForLogging(req);
        try {
            const response = await this.wrapped.generateContent(req, userPromptId);
            const durationMs = Date.now() - startTime;
            this._logApiResponse(response.responseId ?? '', durationMs, response.modelVersion || req.model, userPromptId, response.usageMetadata);
            if (!isInternal) {
                await this.logOpenAIInteraction(openaiRequest, response);
            }
            return response;
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            this._logApiError('', durationMs, error, req.model, userPromptId);
            if (!isInternal) {
                await this.logOpenAIInteraction(openaiRequest, undefined, error);
            }
            throw error;
        }
    }
    async generateContentStream(req, userPromptId) {
        const startTime = Date.now();
        const isInternal = isInternalPromptId(userPromptId);
        if (!isInternal) {
            this.logApiRequest(this.toContents(req.contents), req.model, userPromptId);
        }
        const openaiRequest = isInternal
            ? undefined
            : await this.buildOpenAIRequestForLogging(req);
        let stream;
        try {
            stream = await this.wrapped.generateContentStream(req, userPromptId);
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            this._logApiError('', durationMs, error, req.model, userPromptId);
            if (!isInternal) {
                await this.logOpenAIInteraction(openaiRequest, undefined, error);
            }
            throw error;
        }
        return this.loggingStreamWrapper(stream, startTime, userPromptId, req.model, openaiRequest);
    }
    async *loggingStreamWrapper(stream, startTime, userPromptId, model, openaiRequest) {
        const isInternal = isInternalPromptId(userPromptId);
        // For internal prompts we only need the last usage metadata (for /stats);
        // skip collecting full responses to avoid unnecessary memory overhead.
        const responses = [];
        // Track first-seen IDs so _logApiResponse/_logApiError have accurate
        // values even when we skip collecting full responses for internal prompts.
        let firstResponseId = '';
        let firstModelVersion = '';
        let lastUsageMetadata;
        try {
            for await (const response of stream) {
                if (!firstResponseId && response.responseId) {
                    firstResponseId = response.responseId;
                }
                if (!firstModelVersion && response.modelVersion) {
                    firstModelVersion = response.modelVersion;
                }
                if (!isInternal) {
                    responses.push(response);
                }
                if (response.usageMetadata) {
                    lastUsageMetadata = response.usageMetadata;
                }
                yield response;
            }
            // Only log successful API response if no error occurred
            const durationMs = Date.now() - startTime;
            this._logApiResponse(firstResponseId, durationMs, firstModelVersion || model, userPromptId, lastUsageMetadata);
            if (!isInternal) {
                const consolidatedResponse = this.consolidateGeminiResponsesForLogging(responses);
                await this.logOpenAIInteraction(openaiRequest, consolidatedResponse);
            }
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            this._logApiError(firstResponseId, durationMs, error, firstModelVersion || model, userPromptId);
            if (!isInternal) {
                await this.logOpenAIInteraction(openaiRequest, undefined, error);
            }
            throw error;
        }
    }
    async buildOpenAIRequestForLogging(request) {
        if (!this.openaiLogger) {
            return undefined;
        }
        const requestContext = this.createLoggingRequestContext(request.model);
        const messages = OpenAIContentConverter.convertGeminiRequestToOpenAI(request, requestContext, {
            cleanOrphanToolCalls: false,
        });
        const openaiRequest = {
            model: request.model,
            messages,
        };
        if (request.config?.tools) {
            openaiRequest.tools =
                await OpenAIContentConverter.convertGeminiToolsToOpenAI(request.config.tools, this.schemaCompliance ?? 'auto');
        }
        if (request.config?.temperature !== undefined) {
            openaiRequest.temperature = request.config.temperature;
        }
        if (request.config?.topP !== undefined) {
            openaiRequest.top_p = request.config.topP;
        }
        if (request.config?.maxOutputTokens !== undefined) {
            openaiRequest.max_tokens = request.config.maxOutputTokens;
        }
        if (request.config?.presencePenalty !== undefined) {
            openaiRequest.presence_penalty = request.config.presencePenalty;
        }
        if (request.config?.frequencyPenalty !== undefined) {
            openaiRequest.frequency_penalty = request.config.frequencyPenalty;
        }
        return openaiRequest;
    }
    createLoggingRequestContext(model) {
        return {
            model,
            modalities: this.modalities ?? {},
            startTime: 0,
        };
    }
    async logOpenAIInteraction(openaiRequest, response, error) {
        if (!this.openaiLogger || !openaiRequest) {
            return;
        }
        const openaiResponse = response
            ? this.convertGeminiResponseToOpenAIForLogging(response, openaiRequest)
            : undefined;
        await this.openaiLogger.logInteraction(openaiRequest, openaiResponse, error instanceof Error
            ? error
            : error
                ? new Error(String(error))
                : undefined);
    }
    convertGeminiResponseToOpenAIForLogging(response, openaiRequest) {
        return OpenAIContentConverter.convertGeminiResponseToOpenAI(response, this.createLoggingRequestContext(openaiRequest.model));
    }
    consolidateGeminiResponsesForLogging(responses) {
        if (responses.length === 0) {
            return undefined;
        }
        const consolidated = new GenerateContentResponse();
        const combinedParts = [];
        const functionCallIndex = new Map();
        let finishReason;
        let usageMetadata;
        for (const response of responses) {
            if (response.usageMetadata) {
                usageMetadata = response.usageMetadata;
            }
            const candidate = response.candidates?.[0];
            if (candidate?.finishReason) {
                finishReason = candidate.finishReason;
            }
            const parts = candidate?.content?.parts ?? [];
            for (const part of parts) {
                if (typeof part === 'string') {
                    combinedParts.push({ text: part });
                    continue;
                }
                if ('text' in part) {
                    if (part.text) {
                        combinedParts.push({
                            text: part.text,
                            ...(part.thought ? { thought: true } : {}),
                            ...(part.thoughtSignature
                                ? { thoughtSignature: part.thoughtSignature }
                                : {}),
                        });
                    }
                    continue;
                }
                if ('functionCall' in part && part.functionCall) {
                    const callKey = part.functionCall.id || part.functionCall.name || 'tool_call';
                    const existingIndex = functionCallIndex.get(callKey);
                    const functionPart = { functionCall: part.functionCall };
                    if (existingIndex !== undefined) {
                        combinedParts[existingIndex] = functionPart;
                    }
                    else {
                        functionCallIndex.set(callKey, combinedParts.length);
                        combinedParts.push(functionPart);
                    }
                    continue;
                }
                if ('functionResponse' in part && part.functionResponse) {
                    combinedParts.push({ functionResponse: part.functionResponse });
                    continue;
                }
                combinedParts.push(part);
            }
        }
        const lastResponse = responses[responses.length - 1];
        const lastCandidate = lastResponse.candidates?.[0];
        consolidated.responseId = lastResponse.responseId;
        consolidated.createTime = lastResponse.createTime;
        consolidated.modelVersion = lastResponse.modelVersion;
        consolidated.promptFeedback = lastResponse.promptFeedback;
        consolidated.usageMetadata = usageMetadata;
        consolidated.candidates = [
            {
                content: {
                    role: lastCandidate?.content?.role || 'model',
                    parts: combinedParts,
                },
                ...(finishReason ? { finishReason } : {}),
                index: 0,
                safetyRatings: lastCandidate?.safetyRatings || [],
            },
        ];
        return consolidated;
    }
    async countTokens(req) {
        return this.wrapped.countTokens(req);
    }
    async embedContent(req) {
        return this.wrapped.embedContent(req);
    }
    useSummarizedThinking() {
        return this.wrapped.useSummarizedThinking();
    }
    toContents(contents) {
        if (Array.isArray(contents)) {
            // it's a Content[] or a PartsUnion[]
            return contents.map((c) => this.toContent(c));
        }
        // it's a Content or a PartsUnion
        return [this.toContent(contents)];
    }
    toContent(content) {
        if (Array.isArray(content)) {
            // it's a PartsUnion[]
            return {
                role: 'user',
                parts: this.toParts(content),
            };
        }
        if (typeof content === 'string') {
            // it's a string
            return {
                role: 'user',
                parts: [{ text: content }],
            };
        }
        if ('parts' in content) {
            // it's a Content - process parts to handle thought filtering
            return {
                ...content,
                parts: content.parts
                    ? this.toParts(content.parts.filter((p) => p != null))
                    : [],
            };
        }
        // it's a Part
        return {
            role: 'user',
            parts: [this.toPart(content)],
        };
    }
    toParts(parts) {
        return parts.map((p) => this.toPart(p));
    }
    toPart(part) {
        if (typeof part === 'string') {
            // it's a string
            return { text: part };
        }
        // Handle thought parts for CountToken API compatibility
        // The CountToken API expects parts to have certain required "oneof" fields initialized,
        // but thought parts don't conform to this schema and cause API failures
        if ('thought' in part && part.thought) {
            const thoughtText = `[Thought: ${part.thought}]`;
            const newPart = { ...part };
            delete newPart['thought'];
            const hasApiContent = 'functionCall' in newPart ||
                'functionResponse' in newPart ||
                'inlineData' in newPart ||
                'fileData' in newPart;
            if (hasApiContent) {
                // It's a functionCall or other non-text part. Just strip the thought.
                return newPart;
            }
            // If no other valid API content, this must be a text part.
            // Combine existing text (if any) with the thought, preserving other properties.
            const text = newPart.text;
            const existingText = text ? String(text) : '';
            const combinedText = existingText
                ? `${existingText}\n${thoughtText}`
                : thoughtText;
            return {
                ...newPart,
                text: combinedText,
            };
        }
        return part;
    }
}
//# sourceMappingURL=loggingContentGenerator.js.map