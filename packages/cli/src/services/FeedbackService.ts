/**
 * @license
 * Copyright 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '@vivekmind/core';

export type FeedbackType = 'bug' | 'feature' | 'general' | 'idea';

export interface FeedbackPayload {
  type: FeedbackType;
  content: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Service for submitting feedback to the VivekMind backend.
 */
export class FeedbackService {
  private static readonly FEEDBACK_URL = 'https://api-node.schemaweaver.vivekmind.com/api/feedback';

  /**
   * Submit feedback to the backend.
   */
  static async submitFeedback(
    payload: FeedbackPayload,
    config?: Config
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Enrich metadata with system info if config is available
      const enrichedPayload = {
        ...payload,
        metadata: {
          source: 'vivekmind-cli',
          version: config?.getCliVersion() || 'unknown',
          os: process.platform,
          arch: process.arch,
          node_version: process.version,
          ...(payload.metadata || {}),
        }
      };

      const response = await fetch(this.FEEDBACK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrichedPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { 
          success: false, 
          message: `Server responded with ${response.status}: ${errorText}` 
        };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}
