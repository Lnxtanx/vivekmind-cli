/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DeviceAuthorizationData } from '@vivekmind/core';
import { useVivekMindAuth } from './useVivekMindAuth.js';
import {
  AuthType,
  vivekmindOAuth2Events,
  VivekMindOAuth2Event,
} from '@vivekmind/core';

// Mock the vivekmindOAuth2Events
vi.mock('@vivekmind/core', async () => {
  const actual = await vi.importActual('@vivekmind/core');
  const mockEmitter = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
  };
  return {
    ...actual,
    vivekmindOAuth2Events: mockEmitter,
    VivekMindOAuth2Event: {
      AuthUri: 'authUri',
      AuthProgress: 'authProgress',
    },
  };
});

const mockVivekMindOAuth2Events = vi.mocked(vivekmindOAuth2Events);

describe('useVivekMindAuth', () => {
  const mockDeviceAuth: DeviceAuthorizationData = {
    verification_uri: 'https://oauth.vivekmind.com/device',
    verification_uri_complete: 'https://oauth.vivekmind.com/device?user_code=ABC123',
    user_code: 'ABC123',
    expires_in: 1800,
    device_code: 'device_code_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state when not VivekMind auth', () => {
    const { result } = renderHook(() =>
      useVivekMindAuth(AuthType.USE_GEMINI, false),
    );

    expect(result.current.vivekmindAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelVivekMindAuth).toBeInstanceOf(Function);
  });

  it('should initialize with default state when VivekMind auth but not authenticating', () => {
    const { result } = renderHook(() =>
      useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, false),
    );

    expect(result.current.vivekmindAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelVivekMindAuth).toBeInstanceOf(Function);
  });

  it('should set up event listeners when VivekMind auth and authenticating', () => {
    renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    expect(mockVivekMindOAuth2Events.on).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVivekMindOAuth2Events.on).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should handle device auth event', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vivekmindAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.vivekmindAuthState.authStatus).toBe('polling');
  });

  it('should handle auth progress event - success', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    act(() => {
      handleAuthProgress!('success', 'Authentication successful!');
    });

    expect(result.current.vivekmindAuthState.authStatus).toBe('success');
    expect(result.current.vivekmindAuthState.authMessage).toBe(
      'Authentication successful!',
    );
  });

  it('should handle auth progress event - error', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    act(() => {
      handleAuthProgress!('error', 'Authentication failed');
    });

    expect(result.current.vivekmindAuthState.authStatus).toBe('error');
    expect(result.current.vivekmindAuthState.authMessage).toBe(
      'Authentication failed',
    );
  });

  it('should handle auth progress event - polling', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    act(() => {
      handleAuthProgress!('polling', 'Waiting for user authorization...');
    });

    expect(result.current.vivekmindAuthState.authStatus).toBe('polling');
    expect(result.current.vivekmindAuthState.authMessage).toBe(
      'Waiting for user authorization...',
    );
  });

  it('should handle auth progress event - rate_limit', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    act(() => {
      handleAuthProgress!(
        'rate_limit',
        'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
      );
    });

    expect(result.current.vivekmindAuthState.authStatus).toBe('rate_limit');
    expect(result.current.vivekmindAuthState.authMessage).toBe(
      'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
    );
  });

  it('should handle auth progress event without message', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    act(() => {
      handleAuthProgress!('success');
    });

    expect(result.current.vivekmindAuthState.authStatus).toBe('success');
    expect(result.current.vivekmindAuthState.authMessage).toBe(null);
  });

  it('should clean up event listeners when auth type changes', () => {
    const { rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        useVivekMindAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.VIVEKMIND_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Change to non-VivekMind auth
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(mockVivekMindOAuth2Events.off).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVivekMindOAuth2Events.off).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners when authentication stops', () => {
    const { rerender } = renderHook(
      ({ isAuthenticating }) =>
        useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(mockVivekMindOAuth2Events.off).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVivekMindOAuth2Events.off).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true),
    );

    unmount();

    expect(mockVivekMindOAuth2Events.off).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVivekMindOAuth2Events.off).toHaveBeenCalledWith(
      VivekMindOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should reset state when switching from VivekMind auth to another auth type', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        useVivekMindAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.VIVEKMIND_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vivekmindAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.vivekmindAuthState.authStatus).toBe('polling');

    // Switch to different auth type
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(result.current.vivekmindAuthState.deviceAuth).toBe(null);
    expect(result.current.vivekmindAuthState.authStatus).toBe('idle');
    expect(result.current.vivekmindAuthState.authMessage).toBe(null);
  });

  it('should reset state when authentication stops', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ isAuthenticating }) =>
        useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vivekmindAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.vivekmindAuthState.authStatus).toBe('polling');

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(result.current.vivekmindAuthState.deviceAuth).toBe(null);
    expect(result.current.vivekmindAuthState.authStatus).toBe('idle');
    expect(result.current.vivekmindAuthState.authMessage).toBe(null);
  });

  it('should handle cancelVivekMindAuth function', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVivekMindOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VivekMindOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVivekMindOAuth2Events;
    });

    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    // Set up some state
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vivekmindAuthState.deviceAuth).toEqual(mockDeviceAuth);

    // Cancel auth
    act(() => {
      result.current.cancelVivekMindAuth();
    });

    expect(result.current.vivekmindAuthState.deviceAuth).toBe(null);
    expect(result.current.vivekmindAuthState.authStatus).toBe('idle');
    expect(result.current.vivekmindAuthState.authMessage).toBe(null);
  });

  it('should handle different auth types correctly', () => {
    // Test with VivekMind OAuth - should set up event listeners when authenticating
    const { result: vivekmindResult } = renderHook(() =>
      useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true),
    );
    expect(vivekmindResult.current.vivekmindAuthState.authStatus).toBe('idle');
    expect(mockVivekMindOAuth2Events.on).toHaveBeenCalled();

    // Test with other auth types - should not set up event listeners
    const { result: geminiResult } = renderHook(() =>
      useVivekMindAuth(AuthType.USE_GEMINI, true),
    );
    expect(geminiResult.current.vivekmindAuthState.authStatus).toBe('idle');

    const { result: oauthResult } = renderHook(() =>
      useVivekMindAuth(AuthType.USE_OPENAI, true),
    );
    expect(oauthResult.current.vivekmindAuthState.authStatus).toBe('idle');
  });

  it('should initialize with idle status when starting authentication with VivekMind auth', () => {
    const { result } = renderHook(() => useVivekMindAuth(AuthType.VIVEKMIND_OAUTH, true));

    expect(result.current.vivekmindAuthState.authStatus).toBe('idle');
    expect(mockVivekMindOAuth2Events.on).toHaveBeenCalled();
  });
});
