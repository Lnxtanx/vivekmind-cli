/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { Storage } from './storage.js';
describe('Storage – getGlobalSettingsPath', () => {
    it('returns path to ~/.vivekmind/settings.json', () => {
        const expected = path.join(os.homedir(), '.vivekmind', 'settings.json');
        expect(Storage.getGlobalSettingsPath()).toBe(expected);
    });
});
describe('Storage – additional helpers', () => {
    const projectRoot = '/tmp/project';
    const storage = new Storage(projectRoot);
    it('getWorkspaceSettingsPath returns project/.vivekmind/settings.json', () => {
        const expected = path.join(projectRoot, '.vivekmind', 'settings.json');
        expect(storage.getWorkspaceSettingsPath()).toBe(expected);
    });
    it('getUserCommandsDir returns ~/.vivekmind/commands', () => {
        const expected = path.join(os.homedir(), '.vivekmind', 'commands');
        expect(Storage.getUserCommandsDir()).toBe(expected);
    });
    it('getProjectCommandsDir returns project/.vivekmind/commands', () => {
        const expected = path.join(projectRoot, '.vivekmind', 'commands');
        expect(storage.getProjectCommandsDir()).toBe(expected);
    });
    it('getMcpOAuthTokensPath returns ~/.vivekmind/mcp-oauth-tokens.json', () => {
        const expected = path.join(os.homedir(), '.vivekmind', 'mcp-oauth-tokens.json');
        expect(Storage.getMcpOAuthTokensPath()).toBe(expected);
    });
});
describe('Storage – getRuntimeBaseDir / setRuntimeBaseDir', () => {
    const originalEnv = process.env['VIVEKMIND_RUNTIME_DIR'];
    beforeEach(() => {
        // Reset state before each test
        Storage.setRuntimeBaseDir(null);
        delete process.env['VIVEKMIND_RUNTIME_DIR'];
    });
    afterEach(() => {
        // Restore original env
        Storage.setRuntimeBaseDir(null);
        if (originalEnv !== undefined) {
            process.env['VIVEKMIND_RUNTIME_DIR'] = originalEnv;
        }
        else {
            delete process.env['VIVEKMIND_RUNTIME_DIR'];
        }
    });
    it('defaults to getGlobalVivekMindDir() when nothing is configured', () => {
        expect(Storage.getRuntimeBaseDir()).toBe(Storage.getGlobalVivekMindDir());
    });
    it('uses setRuntimeBaseDir value when set with absolute path', () => {
        const runtimeDir = path.resolve('custom', 'runtime');
        Storage.setRuntimeBaseDir(runtimeDir);
        expect(Storage.getRuntimeBaseDir()).toBe(runtimeDir);
    });
    it('env var VIVEKMIND_RUNTIME_DIR takes priority over setRuntimeBaseDir', () => {
        const settingsDir = path.resolve('from-settings');
        const envDir = path.resolve('from-env');
        Storage.setRuntimeBaseDir(settingsDir);
        process.env['VIVEKMIND_RUNTIME_DIR'] = envDir;
        expect(Storage.getRuntimeBaseDir()).toBe(envDir);
    });
    it('expands tilde (~) in setRuntimeBaseDir', () => {
        Storage.setRuntimeBaseDir('~/custom-runtime');
        const expected = path.join(os.homedir(), 'custom-runtime');
        expect(Storage.getRuntimeBaseDir()).toBe(expected);
    });
    it('expands Windows-style tilde paths in setRuntimeBaseDir', () => {
        Storage.setRuntimeBaseDir('~\\custom-runtime');
        const expected = path.join(os.homedir(), 'custom-runtime');
        expect(Storage.getRuntimeBaseDir()).toBe(expected);
    });
    it('expands tilde (~) in VIVEKMIND_RUNTIME_DIR env var', () => {
        process.env['VIVEKMIND_RUNTIME_DIR'] = '~/env-runtime';
        const expected = path.join(os.homedir(), 'env-runtime');
        expect(Storage.getRuntimeBaseDir()).toBe(expected);
    });
    it('resolves relative paths in setRuntimeBaseDir using process.cwd by default', () => {
        Storage.setRuntimeBaseDir('relative/path');
        const expected = path.resolve('relative/path');
        expect(Storage.getRuntimeBaseDir()).toBe(expected);
    });
    it('resolves relative paths in setRuntimeBaseDir using explicit cwd', () => {
        const cwd = path.resolve('workspace', 'projectA');
        Storage.setRuntimeBaseDir('.vivekmind', cwd);
        expect(Storage.getRuntimeBaseDir()).toBe(path.join(cwd, '.vivekmind'));
    });
    it('ignores cwd when path is absolute', () => {
        const absolutePath = path.resolve('absolute', 'path');
        const cwd = path.resolve('workspace', 'projectA');
        Storage.setRuntimeBaseDir(absolutePath, cwd);
        expect(Storage.getRuntimeBaseDir()).toBe(absolutePath);
    });
    it('ignores cwd when path starts with tilde', () => {
        Storage.setRuntimeBaseDir('~/runtime', path.resolve('workspace', 'projectA'));
        const expected = path.join(os.homedir(), 'runtime');
        expect(Storage.getRuntimeBaseDir()).toBe(expected);
    });
    it('resolves relative paths in VIVEKMIND_RUNTIME_DIR env var', () => {
        process.env['VIVEKMIND_RUNTIME_DIR'] = 'relative/env-path';
        const expected = path.resolve('relative/env-path');
        expect(Storage.getRuntimeBaseDir()).toBe(expected);
    });
    it('resets to default when setRuntimeBaseDir is called with null', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        expect(Storage.getRuntimeBaseDir()).toBe(customDir);
        Storage.setRuntimeBaseDir(null);
        expect(Storage.getRuntimeBaseDir()).toBe(Storage.getGlobalVivekMindDir());
    });
    it('resets to default when setRuntimeBaseDir is called with undefined', () => {
        Storage.setRuntimeBaseDir(path.resolve('custom'));
        Storage.setRuntimeBaseDir(undefined);
        expect(Storage.getRuntimeBaseDir()).toBe(Storage.getGlobalVivekMindDir());
    });
    it('resets to default when setRuntimeBaseDir is called with empty string', () => {
        Storage.setRuntimeBaseDir(path.resolve('custom'));
        Storage.setRuntimeBaseDir('');
        expect(Storage.getRuntimeBaseDir()).toBe(Storage.getGlobalVivekMindDir());
    });
    it('handles bare tilde (~) as home directory', () => {
        Storage.setRuntimeBaseDir('~');
        expect(Storage.getRuntimeBaseDir()).toBe(os.homedir());
    });
});
describe('Storage – runtime path methods use getRuntimeBaseDir', () => {
    const originalEnv = process.env['VIVEKMIND_RUNTIME_DIR'];
    beforeEach(() => {
        Storage.setRuntimeBaseDir(null);
        delete process.env['VIVEKMIND_RUNTIME_DIR'];
    });
    afterEach(() => {
        Storage.setRuntimeBaseDir(null);
        if (originalEnv !== undefined) {
            process.env['VIVEKMIND_RUNTIME_DIR'] = originalEnv;
        }
        else {
            delete process.env['VIVEKMIND_RUNTIME_DIR'];
        }
    });
    it('getGlobalTempDir uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        expect(Storage.getGlobalTempDir()).toBe(path.join(customDir, 'tmp'));
    });
    it('getGlobalDebugDir uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        expect(Storage.getGlobalDebugDir()).toBe(path.join(customDir, 'debug'));
    });
    it('getDebugLogPath uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        expect(Storage.getDebugLogPath('session-123')).toBe(path.join(customDir, 'debug', 'session-123.txt'));
    });
    it('getGlobalIdeDir uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        expect(Storage.getGlobalIdeDir()).toBe(path.join(customDir, 'ide'));
    });
    it('getProjectDir uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        const storage = new Storage('/tmp/project');
        expect(storage.getProjectDir()).toContain(path.join(customDir, 'projects'));
    });
    it('getHistoryDir uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        const storage = new Storage('/tmp/project');
        expect(storage.getHistoryDir()).toContain(path.join(customDir, 'history'));
    });
    it('getProjectTempDir uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        const storage = new Storage('/tmp/project');
        expect(storage.getProjectTempDir()).toContain(path.join(customDir, 'tmp'));
    });
    it('getProjectTempCheckpointsDir uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        const storage = new Storage('/tmp/project');
        expect(storage.getProjectTempCheckpointsDir()).toContain(path.join(customDir, 'tmp'));
        expect(storage.getProjectTempCheckpointsDir()).toMatch(/checkpoints$/);
    });
    it('getHistoryFilePath uses custom runtime base dir', () => {
        const customDir = path.resolve('custom');
        Storage.setRuntimeBaseDir(customDir);
        const storage = new Storage('/tmp/project');
        expect(storage.getHistoryFilePath()).toContain(path.join(customDir, 'tmp'));
        expect(storage.getHistoryFilePath()).toMatch(/shell_history$/);
    });
});
describe('Storage – config paths remain at ~/.vivekmind regardless of runtime dir', () => {
    const originalEnv = process.env['VIVEKMIND_RUNTIME_DIR'];
    const globalVivekMindDir = Storage.getGlobalVivekMindDir();
    beforeEach(() => {
        Storage.setRuntimeBaseDir(path.resolve('custom-runtime'));
        process.env['VIVEKMIND_RUNTIME_DIR'] = path.resolve('env-runtime');
    });
    afterEach(() => {
        Storage.setRuntimeBaseDir(null);
        if (originalEnv !== undefined) {
            process.env['VIVEKMIND_RUNTIME_DIR'] = originalEnv;
        }
        else {
            delete process.env['VIVEKMIND_RUNTIME_DIR'];
        }
    });
    it('getGlobalSettingsPath still uses ~/.vivekmind', () => {
        expect(Storage.getGlobalSettingsPath()).toBe(path.join(globalVivekMindDir, 'settings.json'));
    });
    it('getInstallationIdPath still uses ~/.vivekmind', () => {
        expect(Storage.getInstallationIdPath()).toBe(path.join(globalVivekMindDir, 'installation_id'));
    });
    it('getGoogleAccountsPath still uses ~/.vivekmind', () => {
        expect(Storage.getGoogleAccountsPath()).toBe(path.join(globalVivekMindDir, 'google_accounts.json'));
    });
    it('getMcpOAuthTokensPath still uses ~/.vivekmind', () => {
        expect(Storage.getMcpOAuthTokensPath()).toBe(path.join(globalVivekMindDir, 'mcp-oauth-tokens.json'));
    });
    it('getOAuthCredsPath still uses ~/.vivekmind', () => {
        expect(Storage.getOAuthCredsPath()).toBe(path.join(globalVivekMindDir, 'oauth_creds.json'));
    });
    it('getUserCommandsDir still uses ~/.vivekmind', () => {
        expect(Storage.getUserCommandsDir()).toBe(path.join(globalVivekMindDir, 'commands'));
    });
    it('getGlobalMemoryFilePath still uses ~/.vivekmind', () => {
        expect(Storage.getGlobalMemoryFilePath()).toBe(path.join(globalVivekMindDir, 'memory.md'));
    });
    it('getGlobalBinDir still uses ~/.vivekmind', () => {
        expect(Storage.getGlobalBinDir()).toBe(path.join(globalVivekMindDir, 'bin'));
    });
    it('getUserSkillsDirs still includes ~/.vivekmind/skills', () => {
        const storage = new Storage('/tmp/project');
        const skillsDirs = storage.getUserSkillsDirs();
        expect(skillsDirs.some((dir) => dir === path.join(globalVivekMindDir, 'skills'))).toBe(true);
    });
});
describe('Storage – runtime base dir async context isolation', () => {
    const originalEnv = process.env['VIVEKMIND_RUNTIME_DIR'];
    beforeEach(() => {
        Storage.setRuntimeBaseDir(null);
        delete process.env['VIVEKMIND_RUNTIME_DIR'];
    });
    afterEach(() => {
        Storage.setRuntimeBaseDir(null);
        if (originalEnv !== undefined) {
            process.env['VIVEKMIND_RUNTIME_DIR'] = originalEnv;
        }
        else {
            delete process.env['VIVEKMIND_RUNTIME_DIR'];
        }
    });
    it('uses contextual runtime dir inside runWithRuntimeBaseDir', async () => {
        Storage.setRuntimeBaseDir(path.resolve('global-runtime'));
        const cwd = path.resolve('workspace', 'project-a');
        await Storage.runWithRuntimeBaseDir('.vivekmind', cwd, async () => {
            expect(Storage.getRuntimeBaseDir()).toBe(path.join(cwd, '.vivekmind'));
        });
    });
    it('keeps concurrent contexts isolated', async () => {
        const cwdA = path.resolve('workspace', 'a');
        const cwdB = path.resolve('workspace', 'b');
        const runA = Storage.runWithRuntimeBaseDir('.vivekmind-a', cwdA, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return Storage.getRuntimeBaseDir();
        });
        const runB = Storage.runWithRuntimeBaseDir('.vivekmind-b', cwdB, async () => {
            await new Promise((resolve) => setTimeout(resolve, 1));
            return Storage.getRuntimeBaseDir();
        });
        const [a, b] = await Promise.all([runA, runB]);
        expect(a).toBe(path.join(cwdA, '.vivekmind-a'));
        expect(b).toBe(path.join(cwdB, '.vivekmind-b'));
    });
});
//# sourceMappingURL=storage.test.js.map