/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { InsightData } from '../types/StaticInsightTypes.js';
export declare class TemplateRenderer {
    renderInsightHTML(insights: InsightData): Promise<string>;
}
