/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { tildeifyPath } from '@vivekmind/core';
import { theme } from '../semantic-colors.js';
import { shortAsciiLogo } from './AsciiArt.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

interface HeaderProps {
  customAsciiArt?: string;
  version: string;
  authDisplayType?: string;
  model: string;
  workingDirectory: string;
}

export const Header: React.FC<HeaderProps> = ({
  customAsciiArt,
  version,
  authDisplayType,
  model,
  workingDirectory,
}) => {
  const { columns } = useTerminalSize();
  const isNarrow = columns < 80;
  const displayLogo = isNarrow ? '>_ VivekMind' : (customAsciiArt ?? shortAsciiLogo);
  const displayPath = tildeifyPath(workingDirectory);

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box marginBottom={0}>
        <Text bold color={theme.text.accent}>{displayLogo}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.text.secondary}>{model}</Text>
        <Text color={theme.text.secondary}>·</Text>
        <Text color={theme.text.secondary}>{displayPath}</Text>
        <Text color={theme.text.secondary}>·</Text>
        <Text color={theme.text.secondary}>{authDisplayType || 'Unknown'}</Text>
        <Text color={theme.text.secondary}>·</Text>
        <Text color={theme.text.secondary}>{`v${version}`}</Text>
      </Box>
    </Box>
  );
};
