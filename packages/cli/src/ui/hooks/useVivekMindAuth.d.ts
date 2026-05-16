/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType, type DeviceAuthorizationData } from '@vivekmind/core';
export interface VivekMindAuthState {
    deviceAuth: DeviceAuthorizationData | null;
    authStatus: 'idle' | 'polling' | 'success' | 'error' | 'timeout' | 'rate_limit';
    authMessage: string | null;
}
export interface ExternalAuthState {
    title: string;
    message: string;
    detail?: string;
}
export declare const useVivekMindAuth: (pendingAuthType: AuthType | undefined, isAuthenticating: boolean) => {
    vivekmindAuthState: VivekMindAuthState;
    cancelVivekMindAuth: () => void;
};
