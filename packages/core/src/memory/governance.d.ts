/**
 * @license
 * Copyright 2026 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../config/config.js';
import type { AutoMemoryType } from './types.js';
export type AutoMemoryGovernanceSuggestionType = 'duplicate' | 'conflict' | 'outdated' | 'promote' | 'migrate' | 'forget';
export interface AutoMemoryGovernanceSuggestion {
    type: AutoMemoryGovernanceSuggestionType;
    topic: AutoMemoryType;
    summary: string;
    rationale: string;
    relatedTopic?: AutoMemoryType;
    relatedSummary?: string;
    suggestedTargetTopic?: AutoMemoryType;
}
export interface AutoMemoryGovernanceReview {
    suggestions: AutoMemoryGovernanceSuggestion[];
    strategy: 'none' | 'heuristic' | 'model';
}
export declare function reviewManagedAutoMemoryGovernance(projectRoot: string, options?: {
    config?: Config;
}): Promise<AutoMemoryGovernanceReview>;
