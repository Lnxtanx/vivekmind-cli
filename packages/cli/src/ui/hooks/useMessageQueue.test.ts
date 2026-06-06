/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageQueue, type QueuedMessage } from './useMessageQueue.js';

describe('useMessageQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize with empty queue', () => {
    const { result } = renderHook(() => useMessageQueue());

    expect(result.current.messageQueue).toEqual([]);
    expect(result.current.getQueuedMessagesText()).toBe('');
  });

  it('should add messages to queue', () => {
    const { result } = renderHook(() => useMessageQueue());

    act(() => {
      result.current.addMessage('Test message 1');
      result.current.addMessage('Test message 2');
    });

    expect(result.current.messageQueue).toEqual([
      { text: 'Test message 1', attachments: undefined },
      { text: 'Test message 2', attachments: undefined },
    ]);
  });

  it('should filter out empty messages', () => {
    const { result } = renderHook(() => useMessageQueue());

    act(() => {
      result.current.addMessage('Valid message');
      result.current.addMessage('   '); // Only whitespace
      result.current.addMessage(''); // Empty
      result.current.addMessage('Another valid message');
    });

    expect(result.current.messageQueue).toEqual([
      { text: 'Valid message', attachments: undefined },
      { text: 'Another valid message', attachments: undefined },
    ]);
  });

  it('should clear queue', () => {
    const { result } = renderHook(() => useMessageQueue());

    act(() => {
      result.current.addMessage('Test message');
    });

    expect(result.current.messageQueue).toEqual([
      { text: 'Test message', attachments: undefined },
    ]);

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.messageQueue).toEqual([]);
  });

  it('should return queued messages as text with double newlines', () => {
    const { result } = renderHook(() => useMessageQueue());

    act(() => {
      result.current.addMessage('Message 1');
      result.current.addMessage('Message 2');
      result.current.addMessage('Message 3');
    });

    expect(result.current.getQueuedMessagesText()).toBe(
      'Message 1\n\nMessage 2\n\nMessage 3',
    );
  });

  describe('popAllMessages (cancel and ESC/Up restore)', () => {
    it('returns null when the queue is empty', () => {
      const { result } = renderHook(() => useMessageQueue());

      let popped: string | null = null;
      act(() => {
        popped = result.current.popAllMessages();
      });

      expect(popped).toBeNull();
      expect(result.current.messageQueue).toEqual([]);
    });

    it('joins all queued messages with double newlines and clears the queue', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('Message 1');
        result.current.addMessage('Message 2');
        result.current.addMessage('Message 3');
      });

      let popped: string | null = null;
      act(() => {
        popped = result.current.popAllMessages();
      });

      expect(popped).toBe('Message 1\n\nMessage 2\n\nMessage 3');
      expect(result.current.messageQueue).toEqual([]);
    });

    it('returns a single message without separator', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('Only message');
      });

      let popped: string | null = null;
      act(() => {
        popped = result.current.popAllMessages();
      });

      expect(popped).toBe('Only message');
      expect(result.current.messageQueue).toEqual([]);
    });

    it('joins mixed slash commands and prompts in original order', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('/model');
        result.current.addMessage('hello');
        result.current.addMessage('world');
      });

      let popped: string | null = null;
      act(() => {
        popped = result.current.popAllMessages();
      });

      expect(popped).toBe('/model\n\nhello\n\nworld');
      expect(result.current.messageQueue).toEqual([]);
    });
  });

  describe('drainQueue (mid-turn drain for tool-result injection)', () => {
    it('returns an empty array when the queue is empty', () => {
      const { result } = renderHook(() => useMessageQueue());

      let drained: QueuedMessage[] = [];
      act(() => {
        drained = result.current.drainQueue();
      });
      expect(drained).toEqual([]);
    });

    it('drains all plain-text messages and leaves slash commands queued', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('one');
        result.current.addMessage('two');
        result.current.addMessage('/model');
        result.current.addMessage('three');
      });

      let drained: QueuedMessage[] = [];
      act(() => {
        drained = result.current.drainQueue();
      });

      expect(drained).toEqual([
        { text: 'one', attachments: undefined },
        { text: 'two', attachments: undefined },
        { text: 'three', attachments: undefined },
      ]);
      expect(result.current.messageQueue).toEqual([
        { text: '/model', attachments: undefined },
      ]);
    });

    it('returns an empty array when the queue contains only slash commands', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('/model');
        result.current.addMessage('/help');
      });

      let drained: QueuedMessage[] = [];
      act(() => {
        drained = result.current.drainQueue();
      });

      expect(drained).toEqual([]);
      expect(result.current.messageQueue).toEqual([
        { text: '/model', attachments: undefined },
        { text: '/help', attachments: undefined },
      ]);
    });

    it('drains the whole queue when it contains no slash commands', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('a');
        result.current.addMessage('b');
        result.current.addMessage('c');
      });

      let drained: QueuedMessage[] = [];
      act(() => {
        drained = result.current.drainQueue();
      });

      expect(drained).toEqual([
        { text: 'a', attachments: undefined },
        { text: 'b', attachments: undefined },
        { text: 'c', attachments: undefined },
      ]);
      expect(result.current.messageQueue).toEqual([]);
    });
  });

  describe('popNextSegment', () => {
    it('returns null when the queue is empty', () => {
      const { result } = renderHook(() => useMessageQueue());

      let segment: QueuedMessage | null = null;
      act(() => {
        segment = result.current.popNextSegment();
      });
      expect(segment).toBeNull();
    });

    it('pops the first item and leaves the rest queued', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('/model');
        result.current.addMessage('/help');
      });

      let segment: QueuedMessage | null = null;
      act(() => {
        segment = result.current.popNextSegment();
      });
      expect(segment).toEqual({ text: '/model', attachments: undefined });
      expect(result.current.messageQueue).toEqual([
        { text: '/help', attachments: undefined },
      ]);
    });

    it('drains the queue one item at a time across repeated calls', () => {
      const { result } = renderHook(() => useMessageQueue());

      act(() => {
        result.current.addMessage('/model');
        result.current.addMessage('/theme');
        result.current.addMessage('/help');
      });

      const segments: Array<QueuedMessage | null> = [];
      act(() => {
        segments.push(result.current.popNextSegment());
      });
      act(() => {
        segments.push(result.current.popNextSegment());
      });
      act(() => {
        segments.push(result.current.popNextSegment());
      });
      act(() => {
        segments.push(result.current.popNextSegment());
      });

      expect(segments).toEqual([
        { text: '/model', attachments: undefined },
        { text: '/theme', attachments: undefined },
        { text: '/help', attachments: undefined },
        null,
      ]);
      expect(result.current.messageQueue).toEqual([]);
    });

    it('should include attachments when provided', () => {
      const { result } = renderHook(() => useMessageQueue());
      const attachments = [
        { id: '1', path: 'test.ts', filename: 'test.ts' },
      ];

      act(() => {
        result.current.addMessage('test', attachments);
      });

      expect(result.current.messageQueue).toEqual([
        { text: 'test', attachments },
      ]);
    });
  });
});
