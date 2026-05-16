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
export declare class FeedbackService {
    private static readonly FEEDBACK_URL;
    /**
     * Submit feedback to the backend.
     */
    static submitFeedback(payload: FeedbackPayload, config?: Config): Promise<{
        success: boolean;
        message?: string;
    }>;
}
