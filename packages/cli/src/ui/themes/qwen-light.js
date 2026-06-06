/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';
const vivekmindLightColors = {
    type: 'light',
    Background: '#f8f9fa',
    Foreground: '#5c6166',
    LightBlue: '#55b4d4',
    AccentBlue: '#399ee6',
    AccentPurple: '#a37acc',
    AccentCyan: '#4cbf99',
    AccentGreen: '#86b300',
    AccentYellow: '#f2ae49',
    AccentRed: '#f07171',
    AccentYellowDim: '#8B7000',
    AccentRedDim: '#993333',
    DiffAdded: '#86b300',
    DiffRemoved: '#f07171',
    Comment: '#ABADB1',
    Gray: '#CCCFD3',
    GradientColors: ['#399ee6', '#86b300'],
};
export const VivekMindLight = new Theme('VivekMind Light', 'light', {
    hljs: {
        display: 'block',
        overflowX: 'auto',
        padding: '0.5em',
        background: vivekmindLightColors.Background,
        color: vivekmindLightColors.Foreground,
    },
    'hljs-comment': {
        color: vivekmindLightColors.Comment,
        fontStyle: 'italic',
    },
    'hljs-quote': {
        color: vivekmindLightColors.AccentCyan,
        fontStyle: 'italic',
    },
    'hljs-string': {
        color: vivekmindLightColors.AccentGreen,
    },
    'hljs-constant': {
        color: vivekmindLightColors.AccentCyan,
    },
    'hljs-number': {
        color: vivekmindLightColors.AccentPurple,
    },
    'hljs-keyword': {
        color: vivekmindLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
        color: vivekmindLightColors.AccentYellow,
    },
    'hljs-attribute': {
        color: vivekmindLightColors.AccentYellow,
    },
    'hljs-variable': {
        color: vivekmindLightColors.Foreground,
    },
    'hljs-variable.language': {
        color: vivekmindLightColors.LightBlue,
        fontStyle: 'italic',
    },
    'hljs-title': {
        color: vivekmindLightColors.AccentBlue,
    },
    'hljs-section': {
        color: vivekmindLightColors.AccentGreen,
        fontWeight: 'bold',
    },
    'hljs-type': {
        color: vivekmindLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
        color: vivekmindLightColors.AccentBlue,
    },
    'hljs-tag': {
        color: vivekmindLightColors.LightBlue,
    },
    'hljs-name': {
        color: vivekmindLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
        color: vivekmindLightColors.AccentYellow,
    },
    'hljs-meta': {
        color: vivekmindLightColors.AccentYellow,
    },
    'hljs-symbol': {
        color: vivekmindLightColors.AccentRed,
    },
    'hljs-bullet': {
        color: vivekmindLightColors.AccentYellow,
    },
    'hljs-regexp': {
        color: vivekmindLightColors.AccentCyan,
    },
    'hljs-link': {
        color: vivekmindLightColors.LightBlue,
    },
    'hljs-deletion': {
        color: vivekmindLightColors.AccentRed,
    },
    'hljs-addition': {
        color: vivekmindLightColors.AccentGreen,
    },
    'hljs-emphasis': {
        fontStyle: 'italic',
    },
    'hljs-strong': {
        fontWeight: 'bold',
    },
    'hljs-literal': {
        color: vivekmindLightColors.AccentCyan,
    },
    'hljs-built_in': {
        color: vivekmindLightColors.AccentRed,
    },
    'hljs-doctag': {
        color: vivekmindLightColors.AccentRed,
    },
    'hljs-template-variable': {
        color: vivekmindLightColors.AccentCyan,
    },
    'hljs-selector-id': {
        color: vivekmindLightColors.AccentRed,
    },
}, vivekmindLightColors, lightSemanticColors);
//# sourceMappingURL=qwen-light.js.map