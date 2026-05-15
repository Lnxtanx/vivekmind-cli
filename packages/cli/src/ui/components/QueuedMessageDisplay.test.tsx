/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { QueuedMessageDisplay } from './QueuedMessageDisplay.js';
import type { QueuedMessage } from '../hooks/useMessageQueue.js';

describe('QueuedMessageDisplay', () => {
  it('renders nothing when message queue is empty', () => {
    const { lastFrame } = render(<QueuedMessageDisplay messageQueue={[]} />);

    expect(lastFrame()).toBe('');
  });

  it('displays single queued message', () => {
    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={[{ text: 'First message', attachments: undefined }]} />,
    );

    const output = lastFrame();
    expect(output).toContain('First message');
  });

  it('displays multiple queued messages', () => {
    const messageQueue: QueuedMessage[] = [
      { text: 'First queued message', attachments: undefined },
      { text: 'Second queued message', attachments: undefined },
      { text: 'Third queued message', attachments: undefined },
    ];

    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={messageQueue} />,
    );

    const output = lastFrame();
    expect(output).toContain('First queued message');
    expect(output).toContain('Second queued message');
    expect(output).toContain('Third queued message');
  });

  it('shows overflow indicator when more than 3 messages are queued', () => {
    const messageQueue: QueuedMessage[] = [
      { text: 'Message 1', attachments: undefined },
      { text: 'Message 2', attachments: undefined },
      { text: 'Message 3', attachments: undefined },
      { text: 'Message 4', attachments: undefined },
      { text: 'Message 5', attachments: undefined },
    ];

    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={messageQueue} />,
    );

    const output = lastFrame();
    expect(output).toContain('Message 1');
    expect(output).toContain('Message 2');
    expect(output).toContain('Message 3');
    expect(output).toContain('... (+2 more)');
    expect(output).not.toContain('Message 4');
    expect(output).not.toContain('Message 5');
  });

  it('normalizes whitespace in messages', () => {
    const messageQueue: QueuedMessage[] = [
      { text: 'Message   with\tmultiple\n  whitespace', attachments: undefined }
    ];

    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={messageQueue} />,
    );

    const output = lastFrame();
    expect(output).toContain('Message with multiple whitespace');
  });

  it('shows edit hint when queue has messages', () => {
    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={[{ text: 'Some message', attachments: undefined }]} />,
    );

    const output = lastFrame();
    expect(output).toContain('to edit queued messages');
  });

  it('hides edit hint after showing it enough times', () => {
    // Render with non-empty queue, then empty, then non-empty — repeat
    // to simulate multiple queue cycles. Hint should disappear after 3.
    const { lastFrame, rerender } = render(
      <QueuedMessageDisplay messageQueue={[{ text: 'msg', attachments: undefined }]} />,
    );
    expect(lastFrame()).toContain('to edit queued messages'); // 1st

    rerender(<QueuedMessageDisplay messageQueue={[]} />);
    rerender(<QueuedMessageDisplay messageQueue={[{ text: 'msg', attachments: undefined }]} />);
    expect(lastFrame()).toContain('to edit queued messages'); // 2nd

    rerender(<QueuedMessageDisplay messageQueue={[]} />);
    rerender(<QueuedMessageDisplay messageQueue={[{ text: 'msg', attachments: undefined }]} />);
    expect(lastFrame()).toContain('to edit queued messages'); // 3rd

    rerender(<QueuedMessageDisplay messageQueue={[]} />);
    rerender(<QueuedMessageDisplay messageQueue={[{ text: 'msg', attachments: undefined }]} />);
    expect(lastFrame()).not.toContain('to edit queued messages'); // 4th — hidden
  });
});
