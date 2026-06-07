import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { AcpBridge } from './AcpBridge.js';
import type { PendingPermissionRequest } from './AcpBridge.js';
import type { RequestPermissionResponse } from '@agentclientprotocol/sdk';

function createBridge(): AcpBridge {
  // Provide dummy options — we never call start(), so the process is never spawned.
  return new AcpBridge({ cliEntryPath: '/bin/true', cwd: '/tmp' });
}

/** Insert a fake pending permission request into the bridge's private map. */
function insertPending(
  bridge: AcpBridge,
  id: string,
  overrides?: Partial<Pick<PendingPermissionRequest, 'sessionId' | 'toolCallId' | 'toolName' | 'description' | 'options'>>,
): {
  resolve: ReturnType<typeof vi.fn>;
  reject: ReturnType<typeof vi.fn>;
  timeout: ReturnType<typeof setTimeout>;
  request: PendingPermissionRequest;
} {
  const resolve = vi.fn();
  const reject = vi.fn();
  const timeout = setTimeout(() => {}, 99999); // intentionally far in the future

  const request: PendingPermissionRequest = {
    id,
    sessionId: overrides?.sessionId ?? 'sess-1',
    toolCallId: overrides?.toolCallId ?? 'tc-1',
    toolName: overrides?.toolName ?? 'bash',
    description: overrides?.description ?? 'run ls',
    options: overrides?.options ?? [
      { optionId: 'proceed_once', label: 'Allow once' },
      { optionId: 'proceed_always', label: 'Allow always' },
    ],
    resolve,
    reject,
    timeout,
  };

  (bridge as any).pendingPermissions.set(id, request);
  return { resolve, reject, timeout, request };
}

describe('AcpBridge', () => {
  let bridge: AcpBridge;

  beforeEach(() => {
    bridge = createBridge();
  });

  // ------------------------------------------------------------------ #
  //  setDefaultApprovalMode
  // ------------------------------------------------------------------ #
  describe('setDefaultApprovalMode', () => {
    it('sets mode to ask', () => {
      bridge.setDefaultApprovalMode('ask');
      expect((bridge as any).defaultApprovalMode).toBe('ask');
    });

    it('sets mode to deny', () => {
      bridge.setDefaultApprovalMode('deny');
      expect((bridge as any).defaultApprovalMode).toBe('deny');
    });

    it('sets mode to allow', () => {
      bridge.setDefaultApprovalMode('allow');
      expect((bridge as any).defaultApprovalMode).toBe('allow');
    });
  });

  // ------------------------------------------------------------------ #
  //  setDefaultApprovalMode / setPermissionHandler
  // ------------------------------------------------------------------ #
  describe('setDefaultApprovalMode', () => {
    it('accepts valid modes', () => {
      const bridge = createBridge();
      bridge.setDefaultApprovalMode('allow');
      bridge.setDefaultApprovalMode('deny');
      bridge.setDefaultApprovalMode('ask');
      // No error thrown
    });
  });

  describe('setPermissionHandler', () => {
    it('stores the handler', () => {
      const bridge = createBridge();
      const handler: (
        params: import('@agentclientprotocol/sdk').RequestPermissionRequest,
      ) => Promise<import('@agentclientprotocol/sdk').RequestPermissionResponse> =
        async () => ({
          outcome: { outcome: 'selected', optionId: 'proceed_once' },
        });
      bridge.setPermissionHandler(handler);
      // No error — handler stored
    });
  });

  // ------------------------------------------------------------------ #
  //  resolvePermission
  // ------------------------------------------------------------------ #
  describe('resolvePermission', () => {
    it('resolves a pending permission with the given optionId', () => {
      const { resolve } = insertPending(bridge, 'perm-1');

      const result = bridge.resolvePermission('perm-1', 'proceed_once');

      expect(result).toBe(true);
      expect(resolve).toHaveBeenCalledOnce();
      const response = resolve.mock.calls[0][0] as RequestPermissionResponse;
      expect(response).toEqual({
        outcome: { outcome: 'selected', optionId: 'proceed_once' },
      });
    });

    it('returns false for unknown permission ID', () => {
      const result = bridge.resolvePermission('nonexistent', 'proceed_once');
      expect(result).toBe(false);
    });

    it('clears the pending permission after resolution', () => {
      insertPending(bridge, 'perm-2');

      bridge.resolvePermission('perm-2', 'proceed_once');

      expect((bridge as any).pendingPermissions.has('perm-2')).toBe(false);
    });

    it('clears the timeout after resolution', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const { timeout } = insertPending(bridge, 'perm-3');

      bridge.resolvePermission('perm-3', 'proceed_once');

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeout);
      clearTimeoutSpy.mockRestore();
    });
  });

  // ------------------------------------------------------------------ #
  //  denyPermission
  // ------------------------------------------------------------------ #
  describe('denyPermission', () => {
    it('resolves with deny optionId', () => {
      const { resolve } = insertPending(bridge, 'perm-4');

      const result = bridge.denyPermission('perm-4');

      expect(result).toBe(true);
      expect(resolve).toHaveBeenCalledOnce();
      const response = resolve.mock.calls[0][0] as RequestPermissionResponse;
      expect(response).toEqual({
        outcome: { outcome: 'selected', optionId: 'deny' },
      });
    });

    it('returns false for unknown permission ID', () => {
      const result = bridge.denyPermission('nonexistent');
      expect(result).toBe(false);
    });

    it('clears the pending permission after denial', () => {
      insertPending(bridge, 'perm-5');

      bridge.denyPermission('perm-5');

      expect((bridge as any).pendingPermissions.has('perm-5')).toBe(false);
    });
  });

  // ------------------------------------------------------------------ #
  //  stop
  // ------------------------------------------------------------------ #
  describe('stop', () => {
    it('rejects all pending permissions', () => {
      const { reject: reject1 } = insertPending(bridge, 'perm-6');
      const { reject: reject2 } = insertPending(bridge, 'perm-7');
      const { reject: reject3 } = insertPending(bridge, 'perm-8');

      bridge.stop();

      expect(reject1).toHaveBeenCalledOnce();
      expect(reject2).toHaveBeenCalledOnce();
      expect(reject3).toHaveBeenCalledOnce();

      // All should be rejected with the shutdown error
      for (const rej of [reject1, reject2, reject3]) {
        const error = rej.mock.calls[0][0] as Error;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Bridge shutting down');
      }
    });

    it('clears all pending permissions', () => {
      insertPending(bridge, 'perm-9');
      insertPending(bridge, 'perm-10');
      expect((bridge as any).pendingPermissions.size).toBe(2);

      bridge.stop();

      expect((bridge as any).pendingPermissions.size).toBe(0);
    });
  });

  // ------------------------------------------------------------------ #
  //  EventEmitter interface
  // ------------------------------------------------------------------ #
  describe('EventEmitter interface', () => {
    it('extends EventEmitter', () => {
      const bridge = createBridge();
      expect(bridge).toBeInstanceOf(EventEmitter);
    });

    it('emits and receives events', () => {
      const bridge = createBridge();
      const listener = vi.fn();
      bridge.on('testEvent', listener);
      bridge.emit('testEvent', 'arg1', 'arg2');
      expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});
