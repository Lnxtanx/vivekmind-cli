/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ExtensionConfig } from './extensionManager.js';
import type { ExtensionSetting } from './extensionSettings.js';
export interface GeminiExtensionConfig {
    name: string;
    version: string;
    mcpServers?: Record<string, unknown>;
    contextFileName?: string | string[];
    settings?: ExtensionSetting[];
}
/**
 * Converts a Gemini extension config to VivekMind format.
 * @param extensionDir Path to the Gemini extension directory
 * @returns VivekMind ExtensionConfig
 */
export declare function convertGeminiToQwenConfig(extensionDir: string): ExtensionConfig;
/**
 * Converts a complete Gemini extension package to VivekMind format.
 * Creates a new temporary directory with:
 * 1. Converted vivekmind-extension.json
 * 2. Commands converted from TOML to MD
 * 3. All other files/folders preserved
 *
 * @param extensionDir Path to the Gemini extension directory
 * @returns Object containing converted config and the temporary directory path
 */
export declare function convertGeminiExtensionPackage(extensionDir: string): Promise<{
    config: ExtensionConfig;
    convertedDir: string;
}>;
/**
 * Recursively copies a directory and its contents.
 * @param source Source directory path
 * @param destination Destination directory path
 */
export declare function copyDirectory(source: string, destination: string): Promise<void>;
/**
 * Checks if a config object is in Gemini format.
 * This is a heuristic check based on typical Gemini extension patterns.
 * @param config Configuration object to check
 * @returns true if config appears to be Gemini format
 */
export declare function isGeminiExtensionConfig(extensionDir: string): boolean;
