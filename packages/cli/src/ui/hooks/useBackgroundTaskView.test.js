/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackgroundTaskView, entryId } from './useBackgroundTaskView.js';
function makeFakeRegistry() {
    let cb;
    return {
        setStatusChangeCallback: vi.fn((next) => {
            cb = next;
        }),
        fire: () => cb?.(),
    };
}
function makeConfig(opts) {
    const agentReg = makeFakeRegistry();
    const shellReg = makeFakeRegistry();
    const monitorReg = makeFakeRegistry();
    const config = {
        getBackgroundTaskRegistry: () => ({
            ...agentReg,
            getAll: opts.agents,
        }),
        getBackgroundShellRegistry: () => ({
            ...shellReg,
            getAll: opts.shells,
        }),
        getMonitorRegistry: () => ({
            ...monitorReg,
            getAll: opts.monitors,
        }),
    };
    return { config, agentReg, shellReg, monitorReg };
}
const agent = (id, startTime) => ({
    agentId: id,
    description: 'desc',
    status: 'running',
    startTime,
    abortController: new AbortController(),
});
const shell = (id, startTime) => ({
    shellId: id,
    command: 'sleep 60',
    cwd: '/tmp',
    status: 'running',
    startTime,
    outputPath: '/tmp/x.out',
    abortController: new AbortController(),
});
const monitor = (id, startTime) => ({
    monitorId: id,
    command: 'tail -f log',
    description: 'watch logs',
    status: 'running',
    startTime,
    abortController: new AbortController(),
    eventCount: 0,
    lastEventTime: 0,
    maxEvents: 1000,
    idleTimeoutMs: 300_000,
    droppedLines: 0,
});
describe('useBackgroundTaskView', () => {
    it('returns empty entries when config is null', () => {
        const { result } = renderHook(() => useBackgroundTaskView(null));
        expect(result.current.entries).toEqual([]);
    });
    it('merges entries from all three registries on mount', () => {
        const { config } = makeConfig({
            agents: () => [agent('a1', 100)],
            shells: () => [shell('s1', 50)],
            monitors: () => [monitor('m1', 200)],
        });
        const { result } = renderHook(() => useBackgroundTaskView(config));
        expect(result.current.entries).toHaveLength(3);
        // Sort order is by startTime ascending — shell (50) → agent (100) → monitor (200).
        expect(result.current.entries.map(entryId)).toEqual(['s1', 'a1', 'm1']);
    });
    it('tags each merged entry with the right `kind` discriminator', () => {
        const { config } = makeConfig({
            agents: () => [agent('a1', 0)],
            shells: () => [shell('s1', 0)],
            monitors: () => [monitor('m1', 0)],
        });
        const { result } = renderHook(() => useBackgroundTaskView(config));
        const kinds = result.current.entries.map((e) => e.kind).sort();
        expect(kinds).toEqual(['agent', 'monitor', 'shell']);
    });
    it('subscribes to all three registries on mount', () => {
        const { config, agentReg, shellReg, monitorReg } = makeConfig({
            agents: () => [],
            shells: () => [],
            monitors: () => [],
        });
        renderHook(() => useBackgroundTaskView(config));
        expect(agentReg.setStatusChangeCallback).toHaveBeenCalledWith(expect.any(Function));
        expect(shellReg.setStatusChangeCallback).toHaveBeenCalledWith(expect.any(Function));
        expect(monitorReg.setStatusChangeCallback).toHaveBeenCalledWith(expect.any(Function));
    });
    it('refreshes entries when any registry fires statusChange', () => {
        const agents = [];
        const monitors = [];
        const { config, agentReg, monitorReg } = makeConfig({
            agents: () => agents,
            shells: () => [],
            monitors: () => monitors,
        });
        const { result } = renderHook(() => useBackgroundTaskView(config));
        expect(result.current.entries).toEqual([]);
        // Simulate registry mutation + statusChange fire from each registry.
        agents.push(agent('a1', 100));
        act(() => agentReg.fire());
        expect(result.current.entries.map(entryId)).toEqual(['a1']);
        monitors.push(monitor('m1', 50));
        act(() => monitorReg.fire());
        // monitor's startTime (50) sorts before agent's (100).
        expect(result.current.entries.map(entryId)).toEqual(['m1', 'a1']);
    });
    it('clears all three subscriptions on unmount', () => {
        const { config, agentReg, shellReg, monitorReg } = makeConfig({
            agents: () => [],
            shells: () => [],
            monitors: () => [],
        });
        const { unmount } = renderHook(() => useBackgroundTaskView(config));
        unmount();
        // Each setStatusChangeCallback should have been called twice — once
        // with the refresh function on mount, once with `undefined` on
        // cleanup. Failing this check would mean stale subscribers can fire
        // into an unmounted component (warning + state-update on unmounted
        // tree, sometimes crashes the next render).
        expect(agentReg.setStatusChangeCallback.mock.calls).toEqual([
            [expect.any(Function)],
            [undefined],
        ]);
        expect(shellReg.setStatusChangeCallback.mock.calls).toEqual([
            [expect.any(Function)],
            [undefined],
        ]);
        expect(monitorReg.setStatusChangeCallback.mock.calls).toEqual([
            [expect.any(Function)],
            [undefined],
        ]);
    });
});
//# sourceMappingURL=useBackgroundTaskView.test.js.map