/**
 * @license
 * Copyright 2025 VivekMind team
 * SPDX-License-Identifier: Apache-2.0
 */
export const SUPPORTED_LANGUAGES = [
    {
        code: 'en',
        id: 'en-US',
        fullName: 'English',
        nativeName: 'English',
    },
    {
        code: 'zh-TW',
        id: 'zh-TW',
        fullName: 'Traditional Chinese',
        nativeName: '繁體中文',
    },
    {
        code: 'zh',
        id: 'zh-CN',
        fullName: 'Chinese',
        nativeName: '中文',
    },
    {
        code: 'ru',
        id: 'ru-RU',
        fullName: 'Russian',
        nativeName: 'Русский',
    },
    {
        code: 'de',
        id: 'de-DE',
        fullName: 'German',
        nativeName: 'Deutsch',
    },
    {
        code: 'ja',
        id: 'ja-JP',
        fullName: 'Japanese',
        nativeName: '日本語',
    },
    {
        code: 'pt',
        id: 'pt-BR',
        fullName: 'Portuguese',
        nativeName: 'Português',
    },
    {
        code: 'fr',
        id: 'fr-FR',
        fullName: 'French',
        nativeName: 'Français',
    },
    {
        code: 'ca',
        id: 'ca-ES',
        fullName: 'Catalan',
        nativeName: 'Català',
    },
];
/**
 * Maps a locale code to its English language name.
 * Used for LLM output language instructions.
 */
export function getLanguageNameFromLocale(locale) {
    const lower = locale.toLowerCase();
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === lower);
    return lang?.fullName || 'English';
}
/**
 * Gets the language options for the settings schema.
 */
export function getLanguageSettingsOptions() {
    return [
        { value: 'auto', label: 'Auto (detect from system)' },
        ...SUPPORTED_LANGUAGES.map((l) => ({
            value: l.code,
            label: l.nativeName
                ? `${l.nativeName} (${l.fullName})`
                : `${l.fullName} (${l.id})`,
        })),
    ];
}
/**
 * Gets a string containing all supported language IDs (e.g., "en-US|zh-CN").
 */
export function getSupportedLanguageIds(separator = '|') {
    return SUPPORTED_LANGUAGES.map((l) => l.id).join(separator);
}
//# sourceMappingURL=languages.js.map