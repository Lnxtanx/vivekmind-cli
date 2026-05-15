/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
interface VivekMindAuthOptions {
    region?: string;
    key?: string;
}
/**
 * Handles the authentication process based on the specified command and options
 */
export declare function handleVivekMindAuth(command: 'vivekmind-oauth' | 'coding-plan' | 'openrouter', options: VivekMindAuthOptions): Promise<void>;
/**
 * Runs the interactive authentication flow
 */
export declare function runInteractiveAuth(): Promise<void>;
/**
 * Handles API Key authentication - shows sub-menu for Standard or Custom API key
 */
export declare function handleApiKeyAuth(): Promise<void>;
/**
 * Shows the current authentication status
 */
export declare function showAuthStatus(): Promise<void>;
export {};
