/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VivekMindIgnoreParser } from './vivekMindIgnoreParser.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
describe('VivekMindIgnoreParser', () => {
    let projectRoot;
    async function createTestFile(filePath, content = '') {
        const fullPath = path.join(projectRoot, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content);
    }
    beforeEach(async () => {
        projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vivekmindignore-test-'));
    });
    afterEach(async () => {
        await fs.rm(projectRoot, { recursive: true, force: true });
        vi.restoreAllMocks();
    });
    describe('when .vivekmindignore exists', () => {
        beforeEach(async () => {
            await createTestFile('.vivekmindignore', 'ignored.txt\n# A comment\n/ignored_dir/\n');
            await createTestFile('ignored.txt', 'ignored');
            await createTestFile('not_ignored.txt', 'not ignored');
            await createTestFile(path.join('ignored_dir', 'file.txt'), 'in ignored dir');
            await createTestFile(path.join('subdir', 'not_ignored.txt'), 'not ignored');
        });
        it('should ignore files specified in .vivekmindignore', () => {
            const parser = new VivekMindIgnoreParser(projectRoot);
            expect(parser.getPatterns()).toEqual(['ignored.txt', '/ignored_dir/']);
            expect(parser.isIgnored('ignored.txt')).toBe(true);
            expect(parser.isIgnored('not_ignored.txt')).toBe(false);
            expect(parser.isIgnored(path.join('ignored_dir', 'file.txt'))).toBe(true);
            expect(parser.isIgnored(path.join('subdir', 'not_ignored.txt'))).toBe(false);
        });
    });
    describe('when .vivekmindignore does not exist', () => {
        it('should not load any patterns and not ignore any files', () => {
            const parser = new VivekMindIgnoreParser(projectRoot);
            expect(parser.getPatterns()).toEqual([]);
            expect(parser.isIgnored('any_file.txt')).toBe(false);
        });
    });
});
//# sourceMappingURL=vivekMindIgnoreParser.test.js.map