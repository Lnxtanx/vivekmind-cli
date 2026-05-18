/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { AnthropicContentGenerator } from './anthropicContentGenerator.js';
export { AnthropicContentGenerator } from './anthropicContentGenerator.js';
export function createAnthropicContentGenerator(contentGeneratorConfig, cliConfig) {
    return new AnthropicContentGenerator(contentGeneratorConfig, cliConfig);
}
//# sourceMappingURL=index.js.map