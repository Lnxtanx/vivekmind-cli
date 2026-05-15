/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from 'react';
import { type ArenaManager } from '@vivekmind/core';
interface ArenaStatusDialogProps {
    manager: ArenaManager;
    closeArenaDialog: () => void;
    width?: number;
}
export declare function ArenaStatusDialog({ manager, closeArenaDialog, width, }: ArenaStatusDialogProps): React.JSX.Element;
export {};
