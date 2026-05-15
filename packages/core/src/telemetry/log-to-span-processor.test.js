/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { LogToSpanProcessor } from './log-to-span-processor.js';
describe('LogToSpanProcessor', () => {
    let processor;
    let mockExporter;
    let exportedSpans;
    beforeEach(() => {
        exportedSpans = [];
        mockExporter = {
            export: vi.fn((spans, cb) => {
                exportedSpans.push(...spans);
                cb({ code: 0 });
            }),
            shutdown: vi.fn().mockResolvedValue(undefined),
            forceFlush: vi.fn().mockResolvedValue(undefined),
        };
        processor = new LogToSpanProcessor(mockExporter, 60000);
    });
    afterEach(async () => {
        await processor.shutdown();
    });
    it('converts a log record to a span on flush', async () => {
        const logRecord = {
            body: 'test event',
            hrTime: [1000, 500000000],
            attributes: { key1: 'value1', key2: 42, key3: true },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans).toHaveLength(1);
        const span = exportedSpans[0];
        expect(span.name).toBe('test event');
        expect(span.kind).toBe(SpanKind.INTERNAL);
        expect(span.attributes['key1']).toBe('value1');
        expect(span.attributes['key2']).toBe(42);
        expect(span.attributes['key3']).toBe(true);
        expect(span.attributes['log.bridge']).toBe(true);
        expect(span.startTime).toEqual([1000, 500000000]);
        expect(span.endTime).toEqual([1000, 500000000]);
        expect(span.status.code).toBe(SpanStatusCode.OK);
    });
    it('uses duration_ms to compute span end time', async () => {
        const logRecord = {
            body: 'api response',
            hrTime: [1000, 0],
            attributes: { duration_ms: 250 },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].endTime).toEqual([1000, 250000000]);
    });
    it('ignores non-finite duration_ms values', async () => {
        const logRecord = {
            body: 'api response',
            hrTime: [1000, 0],
            attributes: { duration_ms: Infinity },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].endTime).toEqual([1000, 0]);
    });
    it('handles duration_ms that causes second rollover', async () => {
        const logRecord = {
            body: 'long operation',
            hrTime: [1000, 900000000],
            attributes: { duration_ms: 500 },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].endTime).toEqual([1001, 400000000]);
    });
    it('serializes object attributes to JSON', async () => {
        const logRecord = {
            body: 'event with object',
            hrTime: [1000, 0],
            attributes: { metadata: { nested: true } },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].attributes['metadata']).toBe('{"nested":true}');
    });
    it('handles unserializable object attributes safely', async () => {
        const circular = {};
        circular['self'] = circular;
        const logRecord = {
            body: 'event',
            hrTime: [1000, 0],
            attributes: { bad: circular },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].attributes['bad']).toBe('[unserializable]');
    });
    it('drops sensitive attributes before exporting bridged spans', async () => {
        const logRecord = {
            body: 'event',
            hrTime: [1000, 0],
            attributes: {
                prompt: 'secret prompt',
                function_args: '{"token":"secret"}',
                response_text: 'secret response',
                safe: 'visible',
            },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        const attrs = exportedSpans[0].attributes;
        expect(attrs).not.toHaveProperty('prompt');
        expect(attrs).not.toHaveProperty('function_args');
        expect(attrs).not.toHaveProperty('response_text');
        expect(attrs['safe']).toBe('visible');
        expect(attrs['log.bridge']).toBe(true);
    });
    it('skips null and undefined attributes', async () => {
        const logRecord = {
            body: 'event',
            hrTime: [1000, 0],
            attributes: { valid: 'yes', nullVal: null, undefinedVal: undefined },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        const attrs = exportedSpans[0].attributes;
        expect(attrs['valid']).toBe('yes');
        expect(attrs).not.toHaveProperty('nullVal');
        expect(attrs).not.toHaveProperty('undefinedVal');
        expect(attrs['log.bridge']).toBe(true);
    });
    it('uses "unknown" as span name when body is missing', async () => {
        const logRecord = {
            body: undefined,
            hrTime: [1000, 0],
            attributes: {},
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].name).toBe('unknown');
    });
    it('truncates long span names', async () => {
        const longName = 'x'.repeat(200);
        const logRecord = {
            body: longName,
            hrTime: [1000, 0],
            attributes: {},
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].name).toBe(`${'x'.repeat(128)}...`);
    });
    it('generates unique trace IDs without session.id', async () => {
        const logRecord1 = {
            body: 'event1',
            hrTime: [1000, 0],
            attributes: {},
        };
        const logRecord2 = {
            body: 'event2',
            hrTime: [1001, 0],
            attributes: {},
        };
        processor.onEmit(logRecord1);
        processor.onEmit(logRecord2);
        await processor.forceFlush();
        const ctx1 = exportedSpans[0].spanContext();
        const ctx2 = exportedSpans[1].spanContext();
        expect(ctx1.traceId).toHaveLength(32);
        expect(ctx1.spanId).toHaveLength(16);
        expect(ctx1.traceId).not.toBe(ctx2.traceId);
    });
    it('derives same traceId from same session.id', async () => {
        const logRecord1 = {
            body: 'event1',
            hrTime: [1000, 0],
            attributes: { 'session.id': 'session-abc' },
        };
        const logRecord2 = {
            body: 'event2',
            hrTime: [1001, 0],
            attributes: { 'session.id': 'session-abc' },
        };
        processor.onEmit(logRecord1);
        processor.onEmit(logRecord2);
        await processor.forceFlush();
        const ctx1 = exportedSpans[0].spanContext();
        const ctx2 = exportedSpans[1].spanContext();
        expect(ctx1.traceId).toBe(ctx2.traceId);
        expect(ctx1.spanId).not.toBe(ctx2.spanId);
    });
    it('derives different traceIds from different session.ids', async () => {
        const logRecord1 = {
            body: 'event1',
            hrTime: [1000, 0],
            attributes: { 'session.id': 'session-abc' },
        };
        const logRecord2 = {
            body: 'event2',
            hrTime: [1001, 0],
            attributes: { 'session.id': 'session-xyz' },
        };
        processor.onEmit(logRecord1);
        processor.onEmit(logRecord2);
        await processor.forceFlush();
        const ctx1 = exportedSpans[0].spanContext();
        const ctx2 = exportedSpans[1].spanContext();
        expect(ctx1.traceId).not.toBe(ctx2.traceId);
    });
    it('sets ERROR status for truthy error attributes', async () => {
        const logRecord = {
            body: 'api error',
            hrTime: [1000, 0],
            attributes: {
                error_message: 'connection refused',
                error_type: 'NETWORK',
            },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].status.code).toBe(SpanStatusCode.ERROR);
        expect(exportedSpans[0].status.message).toBe('connection refused');
    });
    it('does not set ERROR for success: false (normal decline)', async () => {
        const logRecord = {
            body: 'tool call declined',
            hrTime: [1000, 0],
            attributes: { success: false, function_name: 'bash' },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].status.code).toBe(SpanStatusCode.OK);
    });
    it('does not set ERROR for falsy error attributes', async () => {
        const logRecord = {
            body: 'ok event',
            hrTime: [1000, 0],
            attributes: { error: null, error_message: '', error_type: '' },
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].status.code).toBe(SpanStatusCode.OK);
    });
    it('preserves severity attributes', async () => {
        const logRecord = {
            body: 'event',
            hrTime: [1000, 0],
            attributes: {},
            severityNumber: 9,
            severityText: 'INFO',
        };
        processor.onEmit(logRecord);
        await processor.forceFlush();
        expect(exportedSpans[0].attributes['log.severity_number']).toBe(9);
        expect(exportedSpans[0].attributes['log.severity_text']).toBe('INFO');
    });
    it('reuses in-flight exports and flushes queued spans afterwards', async () => {
        await processor.shutdown();
        exportedSpans = [];
        const exportCallbacks = [];
        let exportCallCount = 0;
        mockExporter = {
            export: vi.fn((spans, cb) => {
                exportCallCount += 1;
                exportedSpans.push(...spans);
                if (exportCallCount === 1) {
                    exportCallbacks.push(cb);
                }
                else {
                    cb({ code: 0 });
                }
            }),
            shutdown: vi.fn().mockResolvedValue(undefined),
            forceFlush: vi.fn().mockResolvedValue(undefined),
        };
        processor = new LogToSpanProcessor(mockExporter, 60000);
        processor.onEmit({
            body: 'first',
            hrTime: [1000, 0],
            attributes: {},
        });
        const firstFlush = processor.forceFlush();
        await Promise.resolve();
        processor.onEmit({
            body: 'second',
            hrTime: [1001, 0],
            attributes: {},
        });
        const secondFlush = processor.forceFlush();
        await Promise.resolve();
        expect(mockExporter.export).toHaveBeenCalledTimes(1);
        expect(exportedSpans.map((span) => span.name)).toEqual(['first']);
        exportCallbacks[0]({ code: 0 });
        await Promise.all([firstFlush, secondFlush]);
        expect(mockExporter.export).toHaveBeenCalledTimes(2);
        expect(exportedSpans.map((span) => span.name)).toEqual(['first', 'second']);
    });
    it('shutdown flushes remaining spans and shuts down exporter', async () => {
        const logRecord = {
            body: 'final event',
            hrTime: [1000, 0],
            attributes: {},
        };
        processor.onEmit(logRecord);
        await processor.shutdown();
        expect(exportedSpans).toHaveLength(1);
        expect(mockExporter.shutdown).toHaveBeenCalled();
    });
});
//# sourceMappingURL=log-to-span-processor.test.js.map