/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getVisionCapability, VISION_MODEL_MAP } from './model-capabilities.js';

describe('model-capabilities', () => {
  describe('getVisionCapability', () => {
    it('returns capabilities for an exact model ID match', () => {
      const capability = getVisionCapability('gpt-4o');

      expect(capability).toMatchObject({
        supportsVision: true,
        maxImageSizeBytes: 20 * 1024 * 1024,
        supportedImageTypes: ['png', 'jpeg', 'webp', 'gif'],
      });
    });

    it('matches provider-qualified Bedrock model IDs by substring', () => {
      const capability = getVisionCapability(
        'anthropic.claude-sonnet-4-20250514-v1:0',
      );

      expect(capability).toMatchObject({
        supportsVision: true,
        maxImageSizeBytes: 10 * 1024 * 1024,
        supportedImageTypes: ['png', 'jpeg', 'gif', 'webp'],
      });
    });

    it('matches model IDs case-insensitively', () => {
      expect(getVisionCapability('Gemini-2.5-Pro')).toMatchObject({
        supportsVision: true,
        supportedImageTypes: ['png', 'jpeg', 'webp', 'gif', 'bmp'],
      });
    });

    it('returns null for unknown text-only models', () => {
      expect(getVisionCapability('deepseek-chat')).toBeNull();
    });

    it('returns a defensive copy of mutable arrays', () => {
      const capability = getVisionCapability('gpt-4o');
      expect(capability).not.toBeNull();

      capability!.supportedImageTypes.push('mutated');

      expect(VISION_MODEL_MAP['gpt-4o'].supportedImageTypes).not.toContain(
        'mutated',
      );
    });
  });
});
