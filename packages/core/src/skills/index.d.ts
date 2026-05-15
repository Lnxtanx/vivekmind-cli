/**
 * @license
 * Copyright 2025 VivekMind
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * @fileoverview Skills feature implementation
 *
 * This module provides the foundation for the skills feature, which allows
 * users to define reusable skill configurations that can be loaded by the
 * model via a dedicated Skills tool.
 *
 * Skills are stored as directories containing a SKILL.md file with YAML
 * frontmatter for metadata. They can be loaded from four levels
 * (precedence: project > user > extension > bundled):
 * - Project-level: `.vivekmind/skills/`
 * - User-level: `~/.vivekmind/skills/`
 * - Extension-level: provided by installed extensions
 * - Bundled: built-in skills shipped with vivekmind
 */
export type { SkillConfig, SkillLevel, SkillValidationResult, ListSkillsOptions, SkillErrorCode, } from './types.js';
export { SkillError } from './types.js';
export { SkillManager } from './skill-manager.js';
export { SkillActivationRegistry, splitConditionalSkills, } from './skill-activation.js';
