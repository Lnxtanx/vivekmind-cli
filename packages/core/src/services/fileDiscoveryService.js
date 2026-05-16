/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { GitIgnoreParser } from '../utils/gitIgnoreParser.js';
import { VivekMindIgnoreParser } from '../utils/vivekMindIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'node:path';
export class FileDiscoveryService {
    gitIgnoreFilter = null;
    vivekMindIgnoreFilter = null;
    projectRoot;
    constructor(projectRoot) {
        this.projectRoot = path.resolve(projectRoot);
        if (isGitRepository(this.projectRoot)) {
            this.gitIgnoreFilter = new GitIgnoreParser(this.projectRoot);
        }
        this.vivekMindIgnoreFilter = new VivekMindIgnoreParser(this.projectRoot);
    }
    /**
     * Filters a list of file paths based on git ignore rules
     */
    filterFiles(filePaths, options = {
        respectGitIgnore: true,
        respectVivekMindIgnore: true,
    }) {
        return filePaths.filter((filePath) => {
            if (options.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
                return false;
            }
            if (options.respectVivekMindIgnore && this.shouldVivekMindIgnoreFile(filePath)) {
                return false;
            }
            return true;
        });
    }
    /**
     * Filters a list of file paths based on git ignore rules and returns a report
     * with counts of ignored files.
     */
    filterFilesWithReport(filePaths, opts = {
        respectGitIgnore: true,
        respectVivekMindIgnore: true,
    }) {
        const filteredPaths = [];
        let gitIgnoredCount = 0;
        let vivekMindIgnoredCount = 0;
        for (const filePath of filePaths) {
            if (opts.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
                gitIgnoredCount++;
                continue;
            }
            if (opts.respectVivekMindIgnore && this.shouldVivekMindIgnoreFile(filePath)) {
                vivekMindIgnoredCount++;
                continue;
            }
            filteredPaths.push(filePath);
        }
        return {
            filteredPaths,
            gitIgnoredCount,
            vivekMindIgnoredCount,
        };
    }
    /**
     * Checks if a single file should be git-ignored
     */
    shouldGitIgnoreFile(filePath) {
        if (this.gitIgnoreFilter) {
            return this.gitIgnoreFilter.isIgnored(filePath);
        }
        return false;
    }
    /**
     * Checks if a single file should be vivekmind-ignored
     */
    shouldVivekMindIgnoreFile(filePath) {
        if (this.vivekMindIgnoreFilter) {
            return this.vivekMindIgnoreFilter.isIgnored(filePath);
        }
        return false;
    }
    /**
     * Unified method to check if a file should be ignored based on filtering options
     */
    shouldIgnoreFile(filePath, options = {}) {
        const { respectGitIgnore = true, respectVivekMindIgnore: respectVivekMindIgnore = true, } = options;
        if (respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
            return true;
        }
        if (respectVivekMindIgnore && this.shouldVivekMindIgnoreFile(filePath)) {
            return true;
        }
        return false;
    }
    /**
     * Returns loaded patterns from .vivekmindignore
     */
    getVivekMindIgnorePatterns() {
        return this.vivekMindIgnoreFilter?.getPatterns() ?? [];
    }
}
//# sourceMappingURL=fileDiscoveryService.js.map