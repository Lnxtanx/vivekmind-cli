/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
export interface BedrockModelInfo {
    id: string;
    name: string;
    provider: string;
    inputModalities: string[];
    outputModalities: string[];
}
/**
 * Discover available Bedrock foundation models in the given region.
 * Filters to active, on-demand models only.
 *
 * @param region - AWS region (e.g., "us-east-1")
 * @param credentials - AWS credentials (accessKeyId, secretAccessKey, optional sessionToken)
 * @returns Array of discovered model information
 */
export declare function discoverBedrockModels(region: string, credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}): Promise<BedrockModelInfo[]>;
