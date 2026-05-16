/**
 * @license
 * Copyright 2026 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { type ScannedAutoMemoryDocument } from './scan.js';
import type { AutoMemoryMetadata } from './types.js';
export declare function buildManagedAutoMemoryIndex(docs: ScannedAutoMemoryDocument[], _metadata?: Pick<AutoMemoryMetadata, 'updatedAt' | 'lastDreamAt' | 'lastDreamSessionId'>): string;
export declare function rebuildManagedAutoMemoryIndex(projectRoot: string): Promise<string>;
