/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Content, GenerateContentConfig, Part } from '@google/genai';
import type { Config } from '../config/config.js';
export interface SideQueryOptions<TResponse> {
    contents: Content[];
    schema: Record<string, unknown>;
    abortSignal: AbortSignal;
    model?: string;
    systemInstruction?: string | Part | Part[] | Content;
    promptId?: string;
    purpose?: string;
    config?: Omit<GenerateContentConfig, 'systemInstruction' | 'responseJsonSchema' | 'responseMimeType' | 'tools' | 'abortSignal'>;
    validate?: (response: TResponse) => string | null;
}
export declare function runSideQuery<TResponse>(config: Config, options: SideQueryOptions<TResponse>): Promise<TResponse>;
