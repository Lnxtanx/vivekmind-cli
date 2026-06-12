/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { t } from '../../i18n/index.js';

/**
 * Format a token count compactly (e.g. 1234 -> "1.2k", 123456 -> "123.5k").
 */
function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return `${tokens}`;
}

/**
 * Format percentage for display, showing ">100" when exceeding limit.
 */
function formatPercentageUsed(percentage: number): string {
  if (percentage > 1) {
    return '>100';
  }
  return (percentage * 100).toFixed(1);
}

export const ContextUsageDisplay = ({
  promptTokenCount,
  terminalWidth,
  contextWindowSize,
}: {
  promptTokenCount: number;
  terminalWidth: number;
  contextWindowSize: number;
}) => {
  if (promptTokenCount === 0) {
    return null;
  }

  const percentage = promptTokenCount / contextWindowSize;
  const percentageUsed = formatPercentageUsed(percentage);
  const isOverLimit = percentage > 1;
  const tokenStr = formatTokenCount(promptTokenCount);

  // Narrow terminals: just percentage + label
  if (terminalWidth < 80) {
    const label = t('% used');
    return (
      <Text color={isOverLimit ? theme.status.error : theme.text.secondary}>
        {percentageUsed}
        {label}
      </Text>
    );
  }

  // Medium terminals: percentage + label + token count
  if (terminalWidth < 120) {
    const label = t('% ctx');
    return (
      <Text color={isOverLimit ? theme.status.error : theme.text.secondary}>
        {percentageUsed}
        {label}
        <Text dimColor>
          {' '}
          ({tokenStr})
        </Text>
      </Text>
    );
  }

  // Full terminals: percentage + full label + token count
  const label = t('% context used');
  return (
    <Text color={isOverLimit ? theme.status.error : theme.text.secondary}>
      {percentageUsed}
      {label}
      <Text dimColor>
        {' '}
        ({tokenStr}/{formatTokenCount(contextWindowSize)} tok)
      </Text>
    </Text>
  );
};