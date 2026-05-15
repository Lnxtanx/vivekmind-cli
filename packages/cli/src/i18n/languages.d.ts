/**
 * @license
 * Copyright 2025 VivekMind team
 * SPDX-License-Identifier: Apache-2.0
 */
export type SupportedLanguage = 'en' | 'zh' | 'zh-TW' | 'ru' | 'de' | 'ja' | 'pt' | 'fr' | 'ca' | string;
export interface LanguageDefinition {
    /** The internal locale code used by the i18n system (e.g., 'en', 'zh'). */
    code: SupportedLanguage;
    /** The standard name used in UI settings (e.g., 'en-US', 'zh-CN'). */
    id: string;
    /** The full English name of the language (e.g., 'English', 'Chinese'). */
    fullName: string;
    /** The native name of the language (e.g., 'English', '中文'). */
    nativeName?: string;
}
export declare const SUPPORTED_LANGUAGES: readonly LanguageDefinition[];
/**
 * Maps a locale code to its English language name.
 * Used for LLM output language instructions.
 */
export declare function getLanguageNameFromLocale(locale: SupportedLanguage): string;
/**
 * Gets the language options for the settings schema.
 */
export declare function getLanguageSettingsOptions(): Array<{
    value: string;
    label: string;
}>;
/**
 * Gets a string containing all supported language IDs (e.g., "en-US|zh-CN").
 */
export declare function getSupportedLanguageIds(separator?: string): string;
