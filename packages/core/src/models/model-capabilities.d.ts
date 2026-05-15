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
/**
 * Map of known vision model IDs or stable substrings to their capabilities.
 * Keep this independent from provider registration so new providers can reuse
 * the same model-name detection without changing auth or settings schema code.
 */
export declare const VISION_MODEL_MAP: Record<string, VisionCapability>;
/**
 * Look up vision capability by exact model ID first, then by substring.
 * Substring matching lets provider-qualified IDs such as
 * anthropic.claude-sonnet-4-20250514-v1:0 reuse the same entry.
 */
export declare function getVisionCapability(modelId: string): VisionCapability | null;
