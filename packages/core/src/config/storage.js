/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getProjectHash, sanitizeCwd } from '../utils/paths.js';
export const VIVEKMIND_DIR = '.vivekmind';
export const GOOGLE_ACCOUNTS_FILENAME = 'google_accounts.json';
export const OAUTH_FILE = 'oauth_creds.json';
export const SKILL_PROVIDER_CONFIG_DIRS = ['.vivekmind', '.agents'];
const TMP_DIR_NAME = 'tmp';
const BIN_DIR_NAME = 'bin';
const PROJECT_DIR_NAME = 'projects';
const IDE_DIR_NAME = 'ide';
const PLANS_DIR_NAME = 'plans';
const DEBUG_DIR_NAME = 'debug';
const ARENA_DIR_NAME = 'arena';
export class Storage {
    targetDir;
    /**
     * Custom runtime output base directory set via settings.
     * When null, falls back to getGlobalVivekMindDir().
     */
    static runtimeBaseDir = null;
    static runtimeBaseDirContext = new AsyncLocalStorage();
    constructor(targetDir) {
        this.targetDir = targetDir;
    }
    static resolveRuntimeBaseDir(dir, cwd) {
        if (!dir) {
            return null;
        }
        let resolved = dir;
        if (resolved === '~' ||
            resolved.startsWith('~/') ||
            resolved.startsWith('~\\')) {
            const relativeSegments = resolved === '~'
                ? []
                : resolved
                    .slice(2)
                    .split(/[/\\]+/)
                    .filter(Boolean);
            resolved = path.join(os.homedir(), ...relativeSegments);
        }
        if (!path.isAbsolute(resolved)) {
            resolved = cwd ? path.resolve(cwd, resolved) : path.resolve(resolved);
        }
        return resolved;
    }
    /**
     * Sets the custom runtime output base directory.
     * Handles tilde (~) expansion and resolves relative paths to absolute.
     * Pass null/undefined/empty string to reset to default (getGlobalVivekMindDir()).
     * @param dir - The directory path, or null/undefined to reset
     * @param cwd - Base directory for resolving relative paths (defaults to process.cwd()).
     *              Pass the project root so that relative values like ".vivekmind" resolve
     *              per-project, enabling a single global config to work across all projects.
     */
    static setRuntimeBaseDir(dir, cwd) {
        Storage.runtimeBaseDir = Storage.resolveRuntimeBaseDir(dir, cwd);
    }
    /**
     * Runs function execution in an async context with a specific runtime output dir.
     * This is used to isolate runtime output paths between concurrent sessions.
     */
    static runWithRuntimeBaseDir(dir, cwd, fn) {
        const resolved = Storage.resolveRuntimeBaseDir(dir, cwd);
        return Storage.runtimeBaseDirContext.run(resolved, fn);
    }
    /**
     * Returns the base directory for all runtime output (temp files, debug logs,
     * session data, todos, insights, etc.).
     *
     * Priority: VIVEKMIND_RUNTIME_DIR env var > setRuntimeBaseDir() value > getGlobalVivekMindDir()
     * @returns Absolute path to the runtime output base directory
     */
    static getRuntimeBaseDir() {
        const envDir = process.env['VIVEKMIND_RUNTIME_DIR'];
        if (envDir) {
            return (Storage.resolveRuntimeBaseDir(envDir) ?? Storage.getGlobalVivekMindDir());
        }
        const contextualDir = Storage.runtimeBaseDirContext.getStore();
        if (contextualDir !== undefined) {
            return contextualDir ?? Storage.getGlobalVivekMindDir();
        }
        if (Storage.runtimeBaseDir) {
            return Storage.runtimeBaseDir;
        }
        return Storage.getGlobalVivekMindDir();
    }
    static getGlobalVivekMindDir() {
        const homeDir = os.homedir();
        if (!homeDir) {
            return path.join(os.tmpdir(), '.vivekmind');
        }
        return path.join(homeDir, VIVEKMIND_DIR);
    }
    static getMcpOAuthTokensPath() {
        return path.join(Storage.getGlobalVivekMindDir(), 'mcp-oauth-tokens.json');
    }
    static getGlobalSettingsPath() {
        return path.join(Storage.getGlobalVivekMindDir(), 'settings.json');
    }
    static getInstallationIdPath() {
        return path.join(Storage.getGlobalVivekMindDir(), 'installation_id');
    }
    static getGoogleAccountsPath() {
        return path.join(Storage.getGlobalVivekMindDir(), GOOGLE_ACCOUNTS_FILENAME);
    }
    static getUserCommandsDir() {
        return path.join(Storage.getGlobalVivekMindDir(), 'commands');
    }
    static getGlobalMemoryFilePath() {
        return path.join(Storage.getGlobalVivekMindDir(), 'memory.md');
    }
    static getGlobalTempDir() {
        return path.join(Storage.getRuntimeBaseDir(), TMP_DIR_NAME);
    }
    static getGlobalDebugDir() {
        return path.join(Storage.getRuntimeBaseDir(), DEBUG_DIR_NAME);
    }
    static getDebugLogPath(sessionId) {
        return path.join(Storage.getGlobalDebugDir(), `${sessionId}.txt`);
    }
    static getGlobalIdeDir() {
        return path.join(Storage.getRuntimeBaseDir(), IDE_DIR_NAME);
    }
    static getPlansDir() {
        return path.join(Storage.getGlobalVivekMindDir(), PLANS_DIR_NAME);
    }
    static getPlanFilePath(sessionId) {
        return path.join(Storage.getPlansDir(), `${sessionId}.md`);
    }
    static getGlobalBinDir() {
        return path.join(Storage.getGlobalVivekMindDir(), BIN_DIR_NAME);
    }
    static getGlobalArenaDir() {
        return path.join(Storage.getGlobalVivekMindDir(), ARENA_DIR_NAME);
    }
    getVivekMindDir() {
        return path.join(this.targetDir, VIVEKMIND_DIR);
    }
    getProjectDir() {
        const projectId = sanitizeCwd(this.getProjectRoot());
        const projectsDir = path.join(Storage.getRuntimeBaseDir(), PROJECT_DIR_NAME);
        return path.join(projectsDir, projectId);
    }
    getProjectTempDir() {
        const hash = getProjectHash(this.getProjectRoot());
        const tempDir = Storage.getGlobalTempDir();
        const targetDir = path.join(tempDir, hash);
        return targetDir;
    }
    ensureProjectTempDirExists() {
        fs.mkdirSync(this.getProjectTempDir(), { recursive: true });
    }
    static getOAuthCredsPath() {
        return path.join(Storage.getGlobalVivekMindDir(), OAUTH_FILE);
    }
    getProjectRoot() {
        return this.targetDir;
    }
    getHistoryDir() {
        const hash = getProjectHash(this.getProjectRoot());
        const historyDir = path.join(Storage.getRuntimeBaseDir(), 'history');
        const targetDir = path.join(historyDir, hash);
        return targetDir;
    }
    getWorkspaceSettingsPath() {
        return path.join(this.getVivekMindDir(), 'settings.json');
    }
    getProjectCommandsDir() {
        return path.join(this.getVivekMindDir(), 'commands');
    }
    getProjectTempCheckpointsDir() {
        return path.join(this.getProjectTempDir(), 'checkpoints');
    }
    getExtensionsDir() {
        return path.join(this.getVivekMindDir(), 'extensions');
    }
    getExtensionsConfigPath() {
        return path.join(this.getExtensionsDir(), 'vivekmind-extension.json');
    }
    getUserSkillsDirs() {
        const homeDir = os.homedir() || os.tmpdir();
        return SKILL_PROVIDER_CONFIG_DIRS.map((dir) => path.join(homeDir, dir, 'skills'));
    }
    /**
     * Returns the user-level extensions directory (~/.vivekmind/extensions/).
     * Extensions installed at user scope are stored here, as opposed to
     * project-level extensions which live in <project>/.vivekmind/extensions/.
     */
    static getUserExtensionsDir() {
        return path.join(Storage.getGlobalVivekMindDir(), 'extensions');
    }
    getHistoryFilePath() {
        return path.join(this.getProjectTempDir(), 'shell_history');
    }
}
//# sourceMappingURL=storage.js.map