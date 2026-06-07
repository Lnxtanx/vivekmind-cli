/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { AuthType } from '@vivekmind/core';
import {
  formatAcpModelId,
  parseAcpBaseModelId,
  parseAcpModelOption,
} from './acpModelUtils.js';

describe('acpModelUtils', () => {
  it('formats modelId(authType)', () => {
    expect(formatAcpModelId('vivekmind3', AuthType.VIVEKMIND_OAUTH)).toBe(
      `vivekmind3(${AuthType.VIVEKMIND_OAUTH})`,
    );
  });

  it('extracts base model id when string ends with parentheses', () => {
    expect(parseAcpBaseModelId(`vivekmind3(${AuthType.USE_OPENAI})`)).toBe('vivekmind3');
  });

  it('does not strip when parentheses are not a trailing suffix', () => {
    expect(parseAcpBaseModelId('vivekmind3(x) y')).toBe('vivekmind3(x) y');
  });

  it('parses modelId and validates authType', () => {
    expect(parseAcpModelOption(` vivekmind3(${AuthType.USE_OPENAI}) `)).toEqual({
      modelId: 'vivekmind3',
      authType: AuthType.USE_OPENAI,
    });
  });

  it('returns trimmed input as modelId when authType is invalid', () => {
    expect(parseAcpModelOption('vivekmind3(not-a-real-auth)')).toEqual({
      modelId: 'vivekmind3(not-a-real-auth)',
    });
  });
});
