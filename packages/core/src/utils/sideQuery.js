/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DEFAULT_VIVEKMIND_MODEL } from '../config/models.js';
import { SchemaValidator } from './schemaValidator.js';
function buildDefaultPromptId(purpose) {
    return purpose ? `side-query:${purpose}` : 'side-query';
}
export async function runSideQuery(config, options) {
    const response = (await config.getBaseLlmClient().generateJson({
        contents: options.contents,
        schema: options.schema,
        abortSignal: options.abortSignal,
        model: options.model ?? config.getModel() ?? DEFAULT_VIVEKMIND_MODEL,
        systemInstruction: options.systemInstruction,
        promptId: options.promptId ?? buildDefaultPromptId(options.purpose),
        config: options.config,
    }));
    const schemaError = SchemaValidator.validate(options.schema, response);
    if (schemaError) {
        throw new Error(`Invalid side query response: ${schemaError}`);
    }
    const customError = options.validate?.(response);
    if (customError) {
        throw new Error(customError);
    }
    return response;
}
//# sourceMappingURL=sideQuery.js.map