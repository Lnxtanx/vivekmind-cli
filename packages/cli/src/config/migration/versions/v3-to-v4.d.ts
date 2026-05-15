/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { SettingsMigration } from '../types.js';
/**
 * V3 -> V4 migration (managed env key standardization and rebranding).
 */
export declare class V3ToV4Migration implements SettingsMigration {
    readonly fromVersion = 3;
    readonly toVersion = 4;
    shouldMigrate(settings: unknown): boolean;
    migrate(settings: unknown, scope: string): {
        settings: unknown;
        warnings: string[];
    };
}
export declare const v3ToV4Migration: V3ToV4Migration;
