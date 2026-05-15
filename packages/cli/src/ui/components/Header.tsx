/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { shortenPath, tildeifyPath } from '@vivekmind/core';
import { theme } from '../semantic-colors.js';
import { shortAsciiLogo } from './AsciiArt.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';



interface HeaderProps {
  customAsciiArt?: string; // For user-defined ASCII art
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
  const { columns: terminalWidth } = useTerminalSize();

  const displayLogo = customAsciiArt ?? shortAsciiLogo;
  const formattedAuthType = authDisplayType ?? '—';

  const tildeifiedPath = tildeifyPath(workingDirectory);
  const displayPath = shortenPath(tildeifiedPath, Math.max(10, terminalWidth - 20));

  return (
    <Box flexDirection="column" width="100%" marginTop={1} marginBottom={1}>
      {/* ASCII Logo - Centered */}
      <Box justifyContent="center">
        <Text bold color="#E53E3E">{displayLogo}</Text>
      </Box>

      {/* Tagline - Centered */}
      <Box justifyContent="center" marginTop={-1} marginBottom={1}>
        <Text color={theme.text.secondary}>
          Your Universal AI Coding Agent — Any Provider, Your Keys
        </Text>
      </Box>

      {/* Info Panel - Left Aligned with padding */}
      <Box flexDirection="column" paddingLeft={3}>
        <Box>
          <Box width={12}><Text color={theme.text.secondary}>Version</Text></Box>
          <Text color="white">1.0.0</Text>
        </Box>
        <Box>
          <Box width={12}><Text color={theme.text.secondary}>Model</Text></Box>
          <Text color="cyan">{model}</Text>
          <Text color={theme.text.secondary}> (/model to change)</Text>
        </Box>
        <Box>
          <Box width={12}><Text color={theme.text.secondary}>Provider</Text></Box>
          <Text color="white">{formattedAuthType}</Text>
        </Box>
        <Box>
          <Box width={12}><Text color={theme.text.secondary}>Workspace</Text></Box>
          <Text color="white">{displayPath}</Text>
        </Box>
      </Box>
    </Box>
  );
};
