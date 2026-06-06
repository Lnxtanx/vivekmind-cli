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
  const displayLogo = customAsciiArt ?? shortAsciiLogo;
  const displayPath = tildeifyPath(workingDirectory);

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold color={theme.text.accent}>{displayLogo}</Text>
        <Text color={theme.text.secondary}>·</Text>
        <Text color={theme.text.secondary}>{model}</Text>
        <Text color={theme.text.secondary}>·</Text>
        <Text color={theme.text.secondary}>{displayPath}</Text>
      </Box>
    </Box>
  );
};
