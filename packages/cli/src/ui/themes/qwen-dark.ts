/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const vivekmindDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0b0e14',
  Foreground: '#bfbdb6',
  LightBlue: '#59C2FF',
  AccentBlue: '#E53E3E',
  AccentPurple: '#FC8181',
  AccentCyan: '#95E6CB',
  AccentGreen: '#AAD94C',
  AccentYellow: '#FFD700',
  AccentRed: '#E53E3E',
  AccentYellowDim: '#8B7530',
  AccentRedDim: '#8B3A4A',
  DiffAdded: '#AAD94C',
  DiffRemoved: '#E53E3E',
  Comment: '#646A71',
  Gray: '#3D4149',
  GradientColors: ['#E53E3E', '#FC8181'],
};

export const VivekMindDark: Theme = new Theme(
  'VivekMind Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: vivekmindDarkColors.Background,
      color: vivekmindDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: vivekmindDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: vivekmindDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: vivekmindDarkColors.LightBlue,
    },
    'hljs-link': {
      color: vivekmindDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: vivekmindDarkColors.Foreground,
    },
    'hljs-string': {
      color: vivekmindDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: vivekmindDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: vivekmindDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: vivekmindDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: vivekmindDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: vivekmindDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: vivekmindDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: vivekmindDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  vivekmindDarkColors,
  darkSemanticColors,
);
