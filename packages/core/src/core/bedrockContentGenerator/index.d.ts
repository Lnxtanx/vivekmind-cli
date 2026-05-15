/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ContentGenerator, ContentGeneratorConfig } from '../contentGenerator.js';
import type { Config } from '../../config/config.js';
export { BedrockContentGenerator } from './bedrockContentGenerator.js';
export declare function createBedrockContentGenerator(contentGeneratorConfig: ContentGeneratorConfig, cliConfig: Config): ContentGenerator;
