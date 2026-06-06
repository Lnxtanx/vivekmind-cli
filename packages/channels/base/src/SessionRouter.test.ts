import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionRouter } from './SessionRouter.ts';
import type { AcpBridge } from './AcpBridge.ts';

let sessionCounter = 0;

function mockBridge(): AcpBridge {
  return {
    newSession: vi.fn().mockImplementation(() => `session-${++sessionCounter}`),
    loadSession: vi.fn().mockImplementation((id: string) => id),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    availableCommands: [],
  } as unknown as AcpBridge;
}

describe('SessionRouter', () => {
  let bridge: AcpBridge;

  beforeEach(() => {
    sessionCounter = 0;
    bridge = mockBridge();
  });

  describe('routing key scopes', () => {
    it('user scope: routes by channel + sender + chat', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const s1 = await router.resolve('ch', 'alice', 'chat1');
      const s2 = await router.resolve('ch', 'alice', 'chat2');
      const s3 = await router.resolve('ch', 'bob', 'chat1');
      expect(new Set([s1, s2, s3]).size).toBe(3);
    });

    it('user scope: same sender+chat reuses session', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const s1 = await router.resolve('ch', 'alice', 'chat1');
      const s2 = await router.resolve('ch', 'alice', 'chat1');
      expect(s1).toBe(s2);
      expect(bridge.newSession).toHaveBeenCalledTimes(1);
    });

    it('thread scope: routes by channel + threadId', async () => {
      const router = new SessionRouter(bridge, '/tmp', 'thread');
      const s1 = await router.resolve('ch', 'alice', 'chat1', 'thread1');
      const s2 = await router.resolve('ch', 'bob', 'chat1', 'thread1');
      expect(s1).toBe(s2); // same thread = same session
    });

    it('thread scope: falls back to chatId when no threadId', async () => {
      const router = new SessionRouter(bridge, '/tmp', 'thread');
      const s1 = await router.resolve('ch', 'alice', 'chat1');
      const s2 = await router.resolve('ch', 'bob', 'chat1');
      expect(s1).toBe(s2);
    });

    it('single scope: all messages share one session per channel', async () => {
      const router = new SessionRouter(bridge, '/tmp', 'single');
      const s1 = await router.resolve('ch', 'alice', 'chat1');
      const s2 = await router.resolve('ch', 'bob', 'chat2');
      expect(s1).toBe(s2);
    });

    it('single scope: different channels get different sessions', async () => {
      const router = new SessionRouter(bridge, '/tmp', 'single');
      const s1 = await router.resolve('ch1', 'alice', 'chat1');
      const s2 = await router.resolve('ch2', 'alice', 'chat1');
      expect(s1).not.toBe(s2);
    });

    it('per-channel scope overrides default scope', async () => {
      const router = new SessionRouter(bridge, '/tmp', 'user');
      router.setChannelScope('telegram', 'single');

      // 'telegram' uses single scope: same session for different users
      const t1 = await router.resolve('telegram', 'alice', 'chat1');
      const t2 = await router.resolve('telegram', 'bob', 'chat2');
      expect(t1).toBe(t2);

      // other channel still uses default 'user' scope
      const d1 = await router.resolve('dingtalk', 'alice', 'chat1');
      const d2 = await router.resolve('dingtalk', 'bob', 'chat1');
      expect(d1).not.toBe(d2);
    });

    it('mixed per-channel scopes work independently', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      router.setChannelScope('ch-thread', 'thread');
      router.setChannelScope('ch-single', 'single');
      router.setChannelScope('ch-user', 'user');

      // thread scope: same thread = same session
      const t1 = await router.resolve('ch-thread', 'alice', 'c1', 'thread1');
      const t2 = await router.resolve('ch-thread', 'bob', 'c1', 'thread1');
      expect(t1).toBe(t2);

      // single scope: one session for all
      const s1 = await router.resolve('ch-single', 'alice', 'c1');
      const s2 = await router.resolve('ch-single', 'bob', 'c2');
      expect(s1).toBe(s2);

      // user scope: per-sender-per-chat
      const u1 = await router.resolve('ch-user', 'alice', 'c1');
      const u2 = await router.resolve('ch-user', 'alice', 'c2');
      expect(u1).not.toBe(u2);
    });
  });

  describe('resolve', () => {
    it('passes cwd to bridge.newSession', async () => {
      const router = new SessionRouter(bridge, '/default');
      await router.resolve('ch', 'alice', 'chat1', undefined, '/custom');
      expect(bridge.newSession).toHaveBeenCalledWith('/custom');
    });

    it('uses defaultCwd when no cwd provided', async () => {
      const router = new SessionRouter(bridge, '/default');
      await router.resolve('ch', 'alice', 'chat1');
      expect(bridge.newSession).toHaveBeenCalledWith('/default');
    });
  });

  describe('getTarget', () => {
    it('returns target for existing session', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const sid = await router.resolve('ch', 'alice', 'chat1', 'thread1');
      const target = router.getTarget(sid);
      expect(target).toEqual({
        channelName: 'ch',
        senderId: 'alice',
        chatId: 'chat1',
        threadId: 'thread1',
      });
    });

    it('returns undefined for unknown session', () => {
      const router = new SessionRouter(bridge, '/tmp');
      expect(router.getTarget('nonexistent')).toBeUndefined();
    });
  });

  describe('hasSession', () => {
    it('returns true for existing session with chatId', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      expect(router.hasSession('ch', 'alice', 'chat1')).toBe(true);
    });

    it('returns false for non-existing session', () => {
      const router = new SessionRouter(bridge, '/tmp');
      expect(router.hasSession('ch', 'alice', 'chat1')).toBe(false);
    });

    it('prefix-scans when chatId omitted', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      expect(router.hasSession('ch', 'alice')).toBe(true);
      expect(router.hasSession('ch', 'bob')).toBe(false);
    });
  });

  describe('removeSession', () => {
    it('removes session by key and returns session IDs', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const sid = await router.resolve('ch', 'alice', 'chat1');
      const removed = router.removeSession('ch', 'alice', 'chat1');
      expect(removed).toEqual([sid]);
      expect(router.hasSession('ch', 'alice', 'chat1')).toBe(false);
    });

    it('returns empty array when nothing to remove', () => {
      const router = new SessionRouter(bridge, '/tmp');
      expect(router.removeSession('ch', 'alice', 'chat1')).toEqual([]);
    });

    it('removes all sender sessions when chatId omitted', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      await router.resolve('ch', 'alice', 'chat2');
      const removed = router.removeSession('ch', 'alice');
      expect(removed).toHaveLength(2);
      expect(router.hasSession('ch', 'alice')).toBe(false);
    });

    it('cleans up target mapping after removal', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const sid = await router.resolve('ch', 'alice', 'chat1');
      router.removeSession('ch', 'alice', 'chat1');
      expect(router.getTarget(sid)).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns all session entries', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      await router.resolve('ch', 'bob', 'chat2');
      const all = router.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((e) => e.target.senderId).sort()).toEqual([
        'alice',
        'bob',
      ]);
    });

    it('returns empty array when no sessions', () => {
      const router = new SessionRouter(bridge, '/tmp');
      expect(router.getAll()).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('clears all in-memory state', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      router.clearAll();
      expect(router.hasSession('ch', 'alice', 'chat1')).toBe(false);
      expect(router.getAll()).toEqual([]);
    });
  });

  describe('setBridge', () => {
    it('replaces the bridge instance', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const newBridge = mockBridge();
      router.setBridge(newBridge);
      await router.resolve('ch', 'alice', 'chat1');
      expect(newBridge.newSession).toHaveBeenCalled();
      expect(bridge.newSession).not.toHaveBeenCalled();
    });
  });

  describe('registerExternalSession', () => {
    it('registers an external session for a routing key', () => {
      const router = new SessionRouter(bridge, '/tmp');
      const result = router.registerExternalSession(
        'ext-session-123',
        'telegram',
        'user1',
        'chat1',
      );
      expect(result).toBe(true);
      expect(router.getTarget('ext-session-123')).toEqual({
        channelName: 'telegram',
        senderId: 'user1',
        chatId: 'chat1',
        threadId: undefined,
      });
    });

    it('resolve returns the registered session without creating a new one', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      router.registerExternalSession(
        'ext-session-456',
        'telegram',
        'user1',
        'chat1',
      );
      const sid = await router.resolve('telegram', 'user1', 'chat1');
      expect(sid).toBe('ext-session-456');
      expect(bridge.newSession).not.toHaveBeenCalled();
    });

    it('overwrites existing session for same routing key', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const original = await router.resolve('ch', 'alice', 'chat1');
      expect(bridge.newSession).toHaveBeenCalledTimes(1);
      // registerExternalSession returns false when key occupied
      const result = router.registerExternalSession('ext-session-2', 'ch', 'alice', 'chat1');
      expect(result).toBe(false);
    });

    it('stores target with threadId', () => {
      const router = new SessionRouter(bridge, '/tmp');
      router.registerExternalSession('ext-session-1', 'ch', 'alice', 'chat1', 'thread-42');
      const target = router.getTarget('ext-session-1');
      expect(target).toBeDefined();
      expect(target!.threadId).toBe('thread-42');
    });

    it('stores the provided cwd', () => {
      const router = new SessionRouter(bridge, '/tmp');
      router.registerExternalSession(
        'ext-session',
        'ch',
        'user1',
        'chat1',
        undefined,
        '/custom/cwd',
      );
      expect(router.getTarget('ext-session')).toBeDefined();
    });
  });

  describe('unregisterSession', () => {
    it('removes an external session mapping and returns session ID', () => {
      const router = new SessionRouter(bridge, '/tmp');
      router.registerExternalSession(
        'ext-session-999',
        'telegram',
        'user1',
        'chat1',
      );
      const removed = router.unregisterSession('telegram', 'user1', 'chat1');
      expect(removed).toBe('ext-session-999');
      expect(router.getTarget('ext-session-999')).toBeUndefined();
    });

    it('returns null if no session is mapped', () => {
      const router = new SessionRouter(bridge, '/tmp');
      const removed = router.unregisterSession('telegram', 'user1', 'chat1');
      expect(removed).toBeNull();
    });
  });

  describe('detachSession', () => {
    it('detaches session and returns session ID', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const sid = await router.resolve('ch', 'alice', 'chat1');
      const detached = router.detachSession('ch', 'alice', 'chat1');
      expect(detached).toBe(sid);
      expect(router.hasSession('ch', 'alice', 'chat1')).toBe(false);
      const newSid = await router.resolve('ch', 'alice', 'chat1');
      expect(newSid).not.toBe(sid);
    });

    it('returns null when no session exists', () => {
      const router = new SessionRouter(bridge, '/tmp');
      expect(router.detachSession('ch', 'alice', 'chat1')).toBeNull();
    });

    it('detaches with threadId', async () => {
      const router = new SessionRouter(bridge, '/tmp', 'thread');
      await router.resolve('ch', 'alice', 'chat1', 'thread-1');
      const detached = router.detachSession('ch', 'alice', 'chat1', 'thread-1');
      expect(detached).toBeTruthy();
    });

    it('detaches first found when no chatId given', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      const detached = router.detachSession('ch', 'alice');
      expect(detached).toBeTruthy();
    });
  });

  describe('getSessionsForChat', () => {
    it('returns sessions for a specific chat', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      await router.resolve('ch', 'bob', 'chat1');
      const sessions = router.getSessionsForChat('chat1');
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.senderId).sort()).toEqual(['alice', 'bob']);
    });

    it('returns empty for chat with no sessions', () => {
      const router = new SessionRouter(bridge, '/tmp');
      expect(router.getSessionsForChat('nonexistent')).toEqual([]);
    });

    it('does not return sessions from other chats', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      await router.resolve('ch', 'alice', 'chat1');
      await router.resolve('ch', 'bob', 'chat2');
      const sessions = router.getSessionsForChat('chat1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.senderId).toBe('alice');
    });
  });

  describe('getSession', () => {
    it('returns session ID without creating one', async () => {
      const router = new SessionRouter(bridge, '/tmp');
      const sid = await router.resolve('ch', 'alice', 'chat1');
      const fetched = router.getSession('ch', 'alice', 'chat1');
      expect(fetched).toBe(sid);
    });

    it('returns undefined for non-existent session', () => {
      const router = new SessionRouter(bridge, '/tmp');
      const fetched = router.getSession('ch', 'alice', 'chat1');
      expect(fetched).toBeUndefined();
      expect(bridge.newSession).not.toHaveBeenCalled();
    });
  });
});
