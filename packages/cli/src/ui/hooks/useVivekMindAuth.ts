/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AuthType,
  vivekmindOAuth2Events,
  VivekMindOAuth2Event,
  type DeviceAuthorizationData,
} from '@vivekmind/core';

export interface VivekMindAuthState {
  deviceAuth: DeviceAuthorizationData | null;
  authStatus:
    | 'idle'
    | 'polling'
    | 'success'
    | 'error'
    | 'timeout'
    | 'rate_limit';
  authMessage: string | null;
}

export interface ExternalAuthState {
  title: string;
  message: string;
  detail?: string;
}

export const useVivekMindAuth = (
  pendingAuthType: AuthType | undefined,
  isAuthenticating: boolean,
) => {
  const [vivekmindAuthState, setVivekmindAuthState] = useState<VivekMindAuthState>({
    deviceAuth: null,
    authStatus: 'idle',
    authMessage: null,
  });

  const isVivekMindAuth = pendingAuthType === AuthType.VIVEKMIND_OAUTH;

  // Set up event listeners when authentication starts
  useEffect(() => {
    if (!isVivekMindAuth || !isAuthenticating) {
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
    const handleDeviceAuth = (deviceAuth: DeviceAuthorizationData) => {
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

    const handleAuthProgress = (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => {
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
  }, [isVivekMindAuth, isAuthenticating]);

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
