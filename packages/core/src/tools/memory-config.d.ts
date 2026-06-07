/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Lightweight configuration for memory/context file naming.
 * Extracted from memoryTool.ts to avoid loading the full tool module
 * when only the filename configuration is needed.
 */
export declare const VIVEKMIND_CONFIG_DIR = ".vivekmind";
export declare const DEFAULT_CONTEXT_FILENAME = "VIVEKMIND.md";
export declare const AGENT_CONTEXT_FILENAME = "AGENTS.md";
export declare const MEMORY_SECTION_HEADER = "## VivekMind Added Memories";
export declare function setGeminiMdFilename(newFilename: string | string[]): void;
export declare function getCurrentGeminiMdFilename(): string;
export declare function getAllGeminiMdFilenames(): string[];
