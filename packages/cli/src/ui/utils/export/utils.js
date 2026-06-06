/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Generates a filename with timestamp for export files.
 */
export function generateExportFilename(extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `vivekmind-export-${timestamp}.${extension}`;
}
//# sourceMappingURL=utils.js.map