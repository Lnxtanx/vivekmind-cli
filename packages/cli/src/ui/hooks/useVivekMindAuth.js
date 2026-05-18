/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useCallback, useEffect } from 'react';
import { AuthType, vivekmindOAuth2Events, VivekMindOAuth2Event, } from '@vivekmind/core';
export const useVivekMindAuth = (pendingAuthType, isAuthenticating) => {
    const [vivekmindAuthState, setVivekmindAuthState] = useState({
        deviceAuth: null,
        authStatus: 'idle',
        authMessage: null,
    });
    const isQwenAuth = pendingAuthType === AuthType.VIVEKMIND_OAUTH;
    // Set up event listeners when authentication starts
    useEffect(() => {
        if (!isQwenAuth || !isAuthenticating) {
            // Reset state when not authenticating or not VivekMind auth
            setVivekmindAuthState({
                deviceAuth: null,
                authStatus: 'idle',
                authMessage: null,
            });
            return;
        }
        setVivekmindAuthState((prev) => ({
            ...prev,
            authStatus: 'idle',
        }));
        // Set up event listeners
        const handleDeviceAuth = (deviceAuth) => {
            setVivekmindAuthState((prev) => ({
                ...prev,
                deviceAuth: {
                    verification_uri: deviceAuth.verification_uri,
                    verification_uri_complete: deviceAuth.verification_uri_complete,
                    user_code: deviceAuth.user_code,
                    expires_in: deviceAuth.expires_in,
                    device_code: deviceAuth.device_code,
                },
                authStatus: 'polling',
            }));
        };
        const handleAuthProgress = (status, message) => {
            setVivekmindAuthState((prev) => ({
                ...prev,
                authStatus: status,
                authMessage: message || null,
            }));
        };
        // Add event listeners
        vivekmindOAuth2Events.on(VivekMindOAuth2Event.AuthUri, handleDeviceAuth);
        vivekmindOAuth2Events.on(VivekMindOAuth2Event.AuthProgress, handleAuthProgress);
        // Cleanup event listeners when component unmounts or auth finishes
        return () => {
            vivekmindOAuth2Events.off(VivekMindOAuth2Event.AuthUri, handleDeviceAuth);
            vivekmindOAuth2Events.off(VivekMindOAuth2Event.AuthProgress, handleAuthProgress);
        };
    }, [isQwenAuth, isAuthenticating]);
    const cancelVivekMindAuth = useCallback(() => {
        // Emit cancel event to stop polling
        vivekmindOAuth2Events.emit(VivekMindOAuth2Event.AuthCancel);
        setVivekmindAuthState({
            deviceAuth: null,
            authStatus: 'idle',
            authMessage: null,
        });
    }, []);
    return {
        vivekmindAuthState,
        cancelVivekMindAuth,
    };
};
//# sourceMappingURL=useVivekMindAuth.js.map