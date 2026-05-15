/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LspServerManager } from './LspServerManager.js';
function createManager(workspaceRoot) {
    return new LspServerManager({}, {}, {}, {
        requireTrustedWorkspace: false,
        workspaceRoot,
    });
}
describe('LspServerManager', () => {
    describe('isPathSafe', () => {
        it('allows bare commands resolved through PATH', () => {
            const workspaceRoot = path.resolve('/workspace/project');
            const manager = createManager(workspaceRoot);
            expect(manager.isPathSafe('clangd', workspaceRoot)).toBe(true);
        });
        it('allows explicit absolute command paths', () => {
            const workspaceRoot = path.resolve('/workspace/project');
            const absoluteCommand = path.join(path.parse(workspaceRoot).root, 'usr', 'bin', 'clangd');
            const manager = createManager(workspaceRoot);
            expect(manager.isPathSafe(absoluteCommand, workspaceRoot)).toBe(true);
        });
        it('allows relative paths that resolve inside the workspace', () => {
            const workspaceRoot = path.resolve('/workspace/project');
            const manager = createManager(workspaceRoot);
            expect(manager.isPathSafe('./tools/clangd', workspaceRoot, workspaceRoot)).toBe(true);
        });
        it('blocks relative paths that escape the workspace', () => {
            const workspaceRoot = path.resolve('/workspace/project');
            const manager = createManager(workspaceRoot);
            expect(manager.isPathSafe('../bin/clangd', workspaceRoot, workspaceRoot)).toBe(false);
        });
        it('blocks relative paths that use intermediate traversal to escape', () => {
            const workspaceRoot = path.resolve('/workspace/project');
            const manager = createManager(workspaceRoot);
            expect(manager.isPathSafe('./tools/../../../etc/passwd', workspaceRoot, workspaceRoot)).toBe(false);
        });
        it('treats commands with forward slash but no path.sep on Windows as relative', () => {
            const workspaceRoot = path.resolve('/workspace/project');
            const manager = createManager(workspaceRoot);
            // A command like "subdir/server" is relative; if it resolves inside
            // the workspace it should be allowed.
            expect(manager.isPathSafe('tools/clangd', workspaceRoot, workspaceRoot)).toBe(true);
        });
    });
});
//# sourceMappingURL=LspServerManager.test.js.map