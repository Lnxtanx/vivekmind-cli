/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BedrockClient,
  ListFoundationModelsCommand,
} from '@aws-sdk/client-bedrock';
import { createDebugLogger } from '../../utils/debugLogger.js';

const debugLogger = createDebugLogger('BEDROCK_DISCOVERY');

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
export async function discoverBedrockModels(
  region: string,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  },
): Promise<BedrockModelInfo[]> {
  try {
    const client = new BedrockClient({
      region,
      credentials,
    });

    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);

    return (response.modelSummaries || [])
      .filter(
        (m) =>
          m.modelLifecycle?.status === 'ACTIVE' &&
          m.inferenceTypesSupported?.includes('ON_DEMAND'),
      )
      .map((m) => ({
        id: m.modelId!,
        name: m.modelName || m.modelId!,
        provider: m.providerName || 'unknown',
        inputModalities: m.inputModalities || [],
        outputModalities: m.outputModalities || [],
      }));
  } catch (error) {
    debugLogger.warn('Failed to discover Bedrock models:', error);
    return [];
  }
}
