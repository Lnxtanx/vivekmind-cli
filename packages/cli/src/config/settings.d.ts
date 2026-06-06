/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Settings, type MemoryImportFormat } from './settingsSchema.js';
export type { Settings, MemoryImportFormat };
export declare const SETTINGS_DIRECTORY_NAME = ".vivekmind";
export declare const USER_SETTINGS_PATH: string;
export declare const USER_SETTINGS_DIR: string;
export declare const DEFAULT_EXCLUDED_ENV_VARS: string[];
export declare const SETTINGS_VERSION = 4;
export declare const SETTINGS_VERSION_KEY = "$version";
export declare function getSystemSettingsPath(): string;
export declare function getSystemDefaultsPath(): string;
export type { DnsResolutionOrder } from './settingsSchema.js';
export declare enum SettingScope {
    User = "User",
    Workspace = "Workspace",
    System = "System",
    SystemDefaults = "SystemDefaults"
}
export interface CheckpointingSettings {
    enabled?: boolean;
}
export interface AccessibilitySettings {
    enableLoadingPhrases?: boolean;
    screenReader?: boolean;
}
export interface SettingsError {
    message: string;
    path: string;
}
export interface SettingsFile {
    settings: Settings;
    originalSettings: Settings;
    path: string;
    rawJson?: string;
}
/**
 * Collects warnings for ignored legacy and unknown settings keys,
 * as well as migration warnings.
 *
 * For `$version: 2` settings files, we do not apply implicit migrations.
 * Instead, we surface actionable, de-duplicated warnings in the terminal UI.
 */
export declare function getSettingsWarnings(loadedSettings: LoadedSettings): string[];
export declare class LoadedSettings {
    constructor(system: SettingsFile, systemDefaults: SettingsFile, user: SettingsFile, workspace: SettingsFile, isTrusted: boolean, migratedInMemorScopes: Set<SettingScope>, migrationWarnings?: string[]);
    readonly system: SettingsFile;
    readonly systemDefaults: SettingsFile;
    readonly user: SettingsFile;
    readonly workspace: SettingsFile;
    readonly isTrusted: boolean;
    readonly migratedInMemorScopes: Set<SettingScope>;
    readonly migrationWarnings: string[];
    private _merged;
    get merged(): Settings;
    private computeMergedSettings;
    forScope(scope: SettingScope): SettingsFile;
    setValue(scope: SettingScope, key: string, value: unknown): void;
    /**
     * Get user-level hooks from user settings (not merged with workspace).
     * These hooks should always be loaded regardless of folder trust.
     */
    getUserHooks(): Record<string, unknown> | undefined;
    /**
     * Get project-level hooks from workspace settings (not merged).
     * Returns undefined if workspace is not trusted (hooks filtered out).
     */
    getProjectHooks(): Record<string, unknown> | undefined;
}
/**
 * Creates a minimal LoadedSettings instance with empty settings.
 * Used in stream-json mode where settings are ignored.
 */
export declare function createMinimalSettings(): LoadedSettings;
export declare function setUpCloudShellEnvironment(envFilePath: string | null): void;
/**
 * Loads environment variables from .env files and settings.env.
 *
 * Priority order (highest to lowest):
 * 1. CLI flags
 * 2. process.env (system/export/inline environment variables)
 * 3. .env files (no-override mode)
 * 4. settings.env (no-override mode)
 * 5. defaults
 */
export declare function loadEnvironment(settings: Settings): void;
/**
 * Loads settings from user and workspace directories.
 * Project settings override user settings.
 */
export declare function loadSettings(workspaceDir?: string): LoadedSettings;
export declare function saveSettings(settingsFile: SettingsFile, updates?: Record<string, unknown>): void;
