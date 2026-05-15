/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
export const VIVEKMIND_CODE_SIMPLE_ENV_VAR = 'VIVEKMIND_CODE_SIMPLE';
function isTruthy(value) {
    if (!value) {
        return false;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase().trim());
}
export function isBareMode(cliFlag) {
    return cliFlag === true || isTruthy(process.env[VIVEKMIND_CODE_SIMPLE_ENV_VAR]);
}
//# sourceMappingURL=bareMode.js.map