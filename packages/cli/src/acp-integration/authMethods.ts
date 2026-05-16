/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@vivekmind/core';
import type { AuthMethod } from '@agentclientprotocol/sdk';

export function buildAuthMethods(): AuthMethod[] {
  return [
    {
      id: AuthType.USE_OPENAI,
      name: 'Use OpenAI API key',
      description: 'Requires setting the `OPENAI_API_KEY` environment variable',
      _meta: {
        type: 'terminal',
        args: ['--auth-type=openai'],
      },
    },
    {
      id: AuthType.VIVEKMIND_OAUTH,
      name: 'VivekMind OAuth',
      description: 'VivekMind OAuth (free tier discontinued 2026-04-15)',
      _meta: {
        type: 'terminal',
        args: ['--auth-type=vivekmind-oauth'],
      },
    },
  ];
}

export function filterAuthMethodsById(
  authMethods: AuthMethod[],
  authMethodId: string,
): AuthMethod[] {
  return authMethods.filter((method) => method.id === authMethodId);
}

export function pickAuthMethodsForDetails(details?: string): AuthMethod[] {
  const authMethods = buildAuthMethods();
  if (!details) {
    return authMethods;
  }
  if (details.includes('vivekmind-oauth') || details.includes('VivekMind OAuth')) {
    const narrowed = filterAuthMethodsById(authMethods, AuthType.VIVEKMIND_OAUTH);
    return narrowed.length ? narrowed : authMethods;
  }
  return authMethods;
}
