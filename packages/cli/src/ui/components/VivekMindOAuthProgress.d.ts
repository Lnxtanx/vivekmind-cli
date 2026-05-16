/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from 'react';
import type { DeviceAuthorizationData } from '@vivekmind/core';
interface VivekMindOAuthProgressProps {
    onTimeout: () => void;
    onCancel: () => void;
    deviceAuth?: DeviceAuthorizationData;
    authStatus?: 'idle' | 'polling' | 'success' | 'error' | 'timeout' | 'rate_limit';
    authMessage?: string | null;
}
export declare function VivekMindOAuthProgress({ onTimeout, onCancel, deviceAuth, authStatus, authMessage, }: VivekMindOAuthProgressProps): React.JSX.Element;
export {};
