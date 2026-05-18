/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ProviderModelConfig as ModelConfig } from '@vivekmind/core';
/**
 * Coding plan regions
 */
export declare enum CodingPlanRegion {
    CHINA = "china",
    GLOBAL = "global"
}
/**
 * Coding plan template - array of model configurations
 * When user provides an api-key, these configs will be cloned with envKey pointing to the stored api-key
 */
export type CodingPlanTemplate = ModelConfig[];
/**
 * Environment variable key for storing the coding plan API key.
 * Unified key for both regions since they are mutually exclusive.
 */
export declare const CODING_PLAN_ENV_KEY = "BAILIAN_CODING_PLAN_API_KEY";
/**
 * Computes the version hash for the coding plan template.
 * Uses SHA256 of the JSON-serialized template for deterministic versioning.
 * @param template - The template to compute version for
 * @returns Hexadecimal string representing the template version
 */
export declare function computeCodingPlanVersion(template: CodingPlanTemplate): string;
/**
 * Generate the complete coding plan template for a specific region.
 * China region uses legacy description to maintain backward compatibility.
 * Global region uses new description with region indicator.
 * @param region - The region to generate template for
 * @returns Complete model configuration array for the region
 */
export declare function generateCodingPlanTemplate(region: CodingPlanRegion): CodingPlanTemplate;
/**
 * Get the complete configuration for a specific region.
 * @param region - The region to use
 * @returns Object containing template, baseUrl, and version
 */
export declare function getCodingPlanConfig(region: CodingPlanRegion): {
    template: CodingPlanTemplate;
    baseUrl: string;
    version: string;
};
/**
 * Get all unique base URLs for coding plan (used for filtering/config detection).
 * @returns Array of base URLs
 */
export declare function getCodingPlanBaseUrls(): string[];
/**
 * Check if a config belongs to Coding Plan (any region).
 * Returns the region if matched, or false if not a Coding Plan config.
 * @param baseUrl - The baseUrl to check
 * @param envKey - The envKey to check
 * @returns The region if matched, false otherwise
 */
export declare function isCodingPlanConfig(baseUrl: string | undefined, envKey: string | undefined): CodingPlanRegion | false;
/**
 * Get region from baseUrl.
 * @param baseUrl - The baseUrl to check
 * @returns The region if matched, null otherwise
 */
export declare function getRegionFromBaseUrl(baseUrl: string | undefined): CodingPlanRegion | null;
