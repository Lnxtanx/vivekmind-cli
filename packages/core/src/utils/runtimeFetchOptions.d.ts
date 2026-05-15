/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Dispatcher } from 'undici';
/**
 * JavaScript runtime type
 */
export type Runtime = 'node' | 'bun' | 'unknown';
/**
 * Detect the current JavaScript runtime
 */
export declare function detectRuntime(): Runtime;
/**
 * Runtime fetch options for OpenAI SDK
 */
export type OpenAIRuntimeFetchOptions = {
    fetchOptions?: {
        dispatcher?: Dispatcher;
        timeout?: false;
    };
} | undefined;
/**
 * Runtime fetch options for Anthropic SDK
 */
export type AnthropicRuntimeFetchOptions = {
    fetchOptions?: {
        dispatcher?: Dispatcher;
    };
    fetch?: any;
};
/**
 * SDK type identifier
 */
export type SDKType = 'openai' | 'anthropic';
/**
 * Build runtime-specific fetch options for OpenAI SDK
 */
export declare function buildRuntimeFetchOptions(sdkType: 'openai', proxyUrl?: string): OpenAIRuntimeFetchOptions;
/**
 * Build runtime-specific fetch options for Anthropic SDK
 */
export declare function buildRuntimeFetchOptions(sdkType: 'anthropic', proxyUrl?: string): AnthropicRuntimeFetchOptions;
/**
 * Get or create a shared undici dispatcher for the given proxy configuration.
 * The dispatcher is cached so that preconnect and subsequent SDK requests
 * share the same connection pool, enabling TCP+TLS connection reuse.
 *
 * @param proxyUrl - Optional proxy URL; undefined for direct connections
 * @returns A cached undici Dispatcher (Agent or ProxyAgent)
 */
export declare function getOrCreateSharedDispatcher(proxyUrl?: string): Dispatcher;
/**
 * Reset the dispatcher cache (for testing only)
 * @internal
 */
export declare function resetDispatcherCache(): void;
