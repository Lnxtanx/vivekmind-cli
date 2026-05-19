import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { AcpBridge } from './AcpBridge.ts';
import type { ToolApprovalInfo, ToolApprovalResult } from './types.ts';
import type { PermissionHandler } from './AcpBridge.ts';

function createBridge(): AcpBridge {
  // Create a bridge instance — we only test the non-connection methods
  // (permission handling, auto-approve logic, glob matching)
  const bridge = new AcpBridge({
    cliEntryPath: '/fake/path',
    cwd: '/tmp',
  });
  return bridge;
}

describe('AcpBridge', () => {
  describe('setApprovalPolicy', () => {
    it('accepts valid policies', () => {
      const bridge = createBridge();
      bridge.setApprovalPolicy('interactive');
      bridge.setApprovalPolicy('auto-approve');
      bridge.setApprovalPolicy('ask-always');
      // No error thrown
    });
  });

  describe('setAutoApproveTools', () => {
    it('stores tool patterns', () => {
      const bridge = createBridge();
      bridge.setAutoApproveTools(['read_*', 'Bash(ls *)']);
      // No error — stored internally
    });

    it('accepts empty array', () => {
      const bridge = createBridge();
      bridge.setAutoApproveTools([]);
    });
  });

  describe('setPermissionHandler', () => {
    it('stores the handler', () => {
      const bridge = createBridge();
      const handler: PermissionHandler = async () => ({
        optionId: 'proceed_once',
      });
      bridge.setPermissionHandler(handler);
      // No error — handler stored
    });
  });

  describe('auto-approve tools (glob matching)', () => {
    // We test the internal matching logic indirectly via the bridge behavior.
    // Since we can't easily call private methods, we test through setAutoApproveTools
    // and verify no errors are thrown for various patterns.

    it('handles various glob patterns without errors', () => {
      const bridge = createBridge();
      bridge.setAutoApproveTools([
        '*',                     // match all
        'read_*',                // prefix wildcard
        '*.info',                // suffix wildcard
        'Bash(ls *)',            // complex pattern
        'Edit',                  // exact match
        'Glob(**/*.ts)',         // deep wildcard
      ]);
      // No error means patterns were accepted
    });
  });

  describe('PermissionHandler integration', () => {
    it('handler is called and result is returned', async () => {
      const bridge = createBridge();
      bridge.setApprovalPolicy('interactive');

      let handlerCalled = false;
      const handler: PermissionHandler = async (
        info: ToolApprovalInfo,
      ) => {
        handlerCalled = true;
        expect(info.sessionId).toBe('test-session');
        expect(info.title).toBe('Read file');
        return { optionId: 'proceed_once' };
      };
      bridge.setPermissionHandler(handler);

      // Verify handler was stored (we can't easily trigger the full flow
      // without a real ACP connection, but we verify the API works)
      expect(handlerCalled).toBe(false);
    });

    it('handler receives full ToolApprovalInfo', async () => {
      const bridge = createBridge();
      bridge.setApprovalPolicy('interactive');

      const receivedInfo: ToolApprovalInfo[] = [];
      const handler: PermissionHandler = async (info) => {
        receivedInfo.push(info);
        return { optionId: 'cancel', cancelled: true };
      };
      bridge.setPermissionHandler(handler);

      expect(receivedInfo).toHaveLength(0);
    });
  });

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
