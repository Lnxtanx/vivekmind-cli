/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Read and parse a Jupyter notebook file (.ipynb) into a structured text
 * representation. Returns a formatted string with all cells and their outputs.
 */
export declare function readNotebook(filePath: string): Promise<string>;
