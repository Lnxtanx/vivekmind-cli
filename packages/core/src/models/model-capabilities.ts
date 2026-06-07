/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VisionCapability {
  supportsVision: boolean;
  maxImageSizeBytes: number;
  supportedImageTypes: string[];
}

const MB = 1024 * 1024;

const OPENAI_VISION: VisionCapability = {
  supportsVision: true,
  maxImageSizeBytes: 20 * MB,
  supportedImageTypes: ['png', 'jpeg', 'webp', 'gif'],
};

const ANTHROPIC_VISION: VisionCapability = {
  supportsVision: true,
  maxImageSizeBytes: 10 * MB,
  supportedImageTypes: ['png', 'jpeg', 'gif', 'webp'],
};

const GEMINI_VISION: VisionCapability = {
  supportsVision: true,
  maxImageSizeBytes: 20 * MB,
  supportedImageTypes: ['png', 'jpeg', 'webp', 'gif', 'bmp'],
};

const VIVEKMIND_VISION: VisionCapability = {
  supportsVision: true,
  maxImageSizeBytes: 10 * MB,
  supportedImageTypes: ['png', 'jpeg', 'webp', 'gif', 'bmp'],
};

/**
 * Map of known vision model IDs or stable substrings to their capabilities.
 * Keep this independent from provider registration so new providers can reuse
 * the same model-name detection without changing auth or settings schema code.
 */
export const VISION_MODEL_MAP: Record<string, VisionCapability> = {
  'gpt-4o': OPENAI_VISION,
  'gpt-4.1': OPENAI_VISION,
  'gpt-4-turbo': OPENAI_VISION,
  'gpt-5': OPENAI_VISION,
  o1: OPENAI_VISION,
  o3: OPENAI_VISION,
  o4: OPENAI_VISION,

  'claude-sonnet-4': ANTHROPIC_VISION,
  'claude-opus-4': ANTHROPIC_VISION,
  'claude-3-5-sonnet': ANTHROPIC_VISION,
  'claude-3-7-sonnet': ANTHROPIC_VISION,
  'claude-3-opus': ANTHROPIC_VISION,
  'claude-3-sonnet': ANTHROPIC_VISION,
  'claude-3-haiku': ANTHROPIC_VISION,

  'gemini-2.5-pro': GEMINI_VISION,
  'gemini-2.5-flash': GEMINI_VISION,
  'gemini-2.0-flash': GEMINI_VISION,
  'gemini-1.5-pro': GEMINI_VISION,
  'gemini-1.5-flash': GEMINI_VISION,

  'vivekmind3.5-plus': VIVEKMIND_VISION,
  'vivekmind3.6-plus': VIVEKMIND_VISION,
  'coder-model': VIVEKMIND_VISION,
  'vivekmind-vl-': VIVEKMIND_VISION,
  'vivekmind3-vl-': VIVEKMIND_VISION,

  'glm-4.5v': {
    supportsVision: true,
    maxImageSizeBytes: 10 * MB,
    supportedImageTypes: ['png', 'jpeg', 'webp'],
  },
  'kimi-k2.5': {
    supportsVision: true,
    maxImageSizeBytes: 10 * MB,
    supportedImageTypes: ['png', 'jpeg', 'webp', 'gif'],
  },
};

/**
 * Look up vision capability by exact model ID first, then by substring.
 * Substring matching lets provider-qualified IDs such as
 * anthropic.claude-sonnet-4-20250514-v1:0 reuse the same entry.
 */
export function getVisionCapability(modelId: string): VisionCapability | null {
  const normalizedModelId = modelId.toLowerCase();
  const exact = VISION_MODEL_MAP[normalizedModelId];
  if (exact) {
    return { ...exact, supportedImageTypes: [...exact.supportedImageTypes] };
  }

  for (const [key, capability] of Object.entries(VISION_MODEL_MAP)) {
    if (normalizedModelId.includes(key.toLowerCase())) {
      return {
        ...capability,
        supportedImageTypes: [...capability.supportedImageTypes],
      };
    }
  }

  return null;
}
