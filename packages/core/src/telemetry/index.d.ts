/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export declare enum TelemetryTarget {
    GCP = "gcp",
    LOCAL = "local",
    VIVEKMIND = "vivekmind"
}
declare const DEFAULT_TELEMETRY_TARGET = TelemetryTarget.LOCAL;
declare const DEFAULT_OTLP_ENDPOINT = "http://localhost:4317";
export { DEFAULT_TELEMETRY_TARGET, DEFAULT_OTLP_ENDPOINT };
export { initializeTelemetry, shutdownTelemetry, isTelemetrySdkInitialized, } from './sdk.js';
export { resolveTelemetrySettings, parseBooleanEnvFlag, parseTelemetryTargetValue, } from './config.js';
export { logStartSession, logUserPrompt, logUserRetry, logToolCall, logApiRequest, logApiError, logApiCancel, logApiResponse, logFlashFallback, logSlashCommand, logConversationFinishedEvent, logKittySequenceOverflow, logChatCompression, logToolOutputTruncated, logExtensionEnable, logExtensionInstallEvent, logExtensionUninstall, logExtensionDisable, logExtensionUpdateEvent, logRipgrepFallback, logNextSpeakerCheck, logAuth, logSkillLaunch, logUserFeedback, logArenaSessionStarted, logArenaAgentCompleted, logArenaSessionEnded, logMemoryExtract, logMemoryDream, logMemoryRecall, } from './loggers.js';
export type { SlashCommandEvent, ChatCompressionEvent } from './types.js';
export { SlashCommandStatus, EndSessionEvent, UserPromptEvent, UserRetryEvent, ApiRequestEvent, ApiErrorEvent, ApiResponseEvent, ApiCancelEvent, FlashFallbackEvent, StartSessionEvent, ToolCallEvent, ConversationFinishedEvent, KittySequenceOverflowEvent, ToolOutputTruncatedEvent, RipgrepFallbackEvent, NextSpeakerCheckEvent, AuthEvent, SkillLaunchEvent, UserFeedbackEvent, UserFeedbackRating, makeArenaSessionStartedEvent, makeArenaAgentCompletedEvent, makeArenaSessionEndedEvent, MemoryExtractEvent, MemoryDreamEvent, MemoryRecallEvent, } from './types.js';
export { makeSlashCommandEvent, makeChatCompressionEvent } from './types.js';
export type { ArenaSessionStartedEvent, ArenaAgentCompletedEvent, ArenaSessionEndedEvent, ArenaSessionEndedStatus, ArenaAgentCompletedStatus, } from './types.js';
export type { TelemetryEvent } from './types.js';
export { SpanStatusCode, ValueType } from '@opentelemetry/api';
export { SemanticAttributes } from '@opentelemetry/semantic-conventions';
export * from './uiTelemetry.js';
export { recordToolCallMetrics, recordTokenUsageMetrics, recordApiResponseMetrics, recordApiErrorMetrics, recordFileOperationMetric, recordInvalidChunk, recordContentRetry, recordContentRetryFailure, recordStartupPerformance, recordMemoryUsage, recordCpuUsage, recordToolQueueDepth, recordToolExecutionBreakdown, recordTokenEfficiency, recordApiRequestBreakdown, recordPerformanceScore, recordPerformanceRegression, recordBaselineComparison, isPerformanceMonitoringActive, recordArenaSessionStartedMetrics, recordArenaAgentCompletedMetrics, recordArenaSessionEndedMetrics, recordMemoryExtractMetrics, recordMemoryDreamMetrics, recordMemoryRecallMetrics, PerformanceMetricType, MemoryMetricType, ToolExecutionPhase, ApiRequestPhase, FileOperation, } from './metrics.js';
export { VivekMindLogger } from './vivekmind-logger/vivekmind-logger.js';
export { sanitizeHookName } from './sanitize.js';
