/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { isSlashCommand } from '../utils/commandUtils.js';
import { type Attachment } from '../types.js';

export interface QueuedMessage {
  text: string;
  attachments?: Attachment[];
}

export interface UseMessageQueueReturn {
  messageQueue: QueuedMessage[];
  addMessage: (message: string, attachments?: Attachment[]) => void;
  clearQueue: () => void;
  getQueuedMessagesText: () => string;
  /** Drain the entire queue joined with `\n\n`. For Ctrl+C / ESC / Up edit-restore. */
  popAllMessages: () => string | null;
  /** Drain plain-text prompts; leave slash commands queued. Safe from non-React callbacks. */
  drainQueue: () => QueuedMessage[];
  /** Pop the first item from the queue. */
  popNextSegment: () => QueuedMessage | null;
}

export function useMessageQueue(): UseMessageQueueReturn {
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  // Synchronous mirror so non-React callbacks see the latest queue.
  const queueRef = useRef<QueuedMessage[]>([]);

  const addMessage = useCallback((message: string, attachments?: Attachment[]) => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 0) {
      const newItem: QueuedMessage = { text: trimmedMessage, attachments };
      queueRef.current = [...queueRef.current, newItem];
      setMessageQueue(queueRef.current);
    }
  }, []);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setMessageQueue([]);
  }, []);

  const getQueuedMessagesText = useCallback(() => {
    if (messageQueue.length === 0) return '';
    return messageQueue.map((m) => m.text).join('\n\n');
  }, [messageQueue]);

  const popAllMessages = useCallback((): string | null => {
    const current = queueRef.current;
    if (current.length === 0) return null;
    queueRef.current = [];
    setMessageQueue([]);
    return current.map((m) => m.text).join('\n\n');
  }, []);

  const drainQueue = useCallback((): QueuedMessage[] => {
    const current = queueRef.current;
    if (current.length === 0) return [];
    const drained = current.filter((m) => !isSlashCommand(m.text));
    if (drained.length === 0) return [];
    const rest = current.filter((m) => isSlashCommand(m.text));
    queueRef.current = rest;
    setMessageQueue(rest);
    return drained;
  }, []);

  const popNextSegment = useCallback((): QueuedMessage | null => {
    const current = queueRef.current;
    if (current.length === 0) return null;
    const [head, ...rest] = current;
    queueRef.current = rest || [];
    setMessageQueue(queueRef.current);
    return head;
  }, []);

  return {
    messageQueue,
    addMessage,
    clearQueue,
    getQueuedMessagesText,
    popAllMessages,
    drainQueue,
    popNextSegment,
  };
}
