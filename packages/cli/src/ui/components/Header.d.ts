/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from 'react';
interface HeaderProps {
    customAsciiArt?: string;
    version: string;
    authDisplayType?: string;
    model: string;
    workingDirectory: string;
}
export declare const Header: React.FC<HeaderProps>;
export {};
