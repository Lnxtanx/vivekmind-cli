/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LogRecordProcessor, ReadableLogRecord } from '@opentelemetry/sdk-logs';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
/**
 * A LogRecordProcessor that converts each OTel log record into a span
 * and exports it directly through the provided SpanExporter.
 *
 * This bridges the gap for backends (e.g., Alibaba Cloud) that support
 * traces and metrics but not logs over OTLP. Instead of going through
 * the global TracerProvider (which can break in bundled environments),
 * this processor directly constructs ReadableSpan objects and feeds
 * them to the exporter.
 *
 * When a log record has a `duration_ms` attribute, the resulting span
 * will have a matching duration. Otherwise, the span is instantaneous.
 */
export declare class LogToSpanProcessor implements LogRecordProcessor {
    private readonly spanExporter;
    private buffer;
    private flushTimer;
    private inFlightExport;
    private readonly flushIntervalMs;
    constructor(spanExporter: SpanExporter, flushIntervalMs?: number);
    onEmit(logRecord: ReadableLogRecord): void;
    private flush;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
}
