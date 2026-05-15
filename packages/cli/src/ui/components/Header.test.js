import { jsx as _jsx } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Header } from './Header.js';
import * as useTerminalSize from '../hooks/useTerminalSize.js';
vi.mock('../hooks/useTerminalSize.js');
const useTerminalSizeMock = vi.mocked(useTerminalSize.useTerminalSize);
const defaultProps = {
    version: '1.0.0',
    authDisplayType: 'API Key',
    model: 'qwen-coder-plus',
    workingDirectory: '/home/user/projects/test',
};
describe('<Header />', () => {
    const originalNoColor = process.env['NO_COLOR'];
    beforeEach(() => {
        delete process.env['NO_COLOR'];
        useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
    });
    afterEach(() => {
        if (originalNoColor === undefined) {
            delete process.env['NO_COLOR'];
        }
        else {
            process.env['NO_COLOR'] = originalNoColor;
        }
    });
    it('renders the ASCII logo on wide terminal', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps }));
        expect(lastFrame()).toContain('██╔═══██╗');
    });
    it('hides the ASCII logo on narrow terminal', () => {
        useTerminalSizeMock.mockReturnValue({ columns: 60, rows: 24 });
        const { lastFrame } = render(_jsx(Header, { ...defaultProps }));
        expect(lastFrame()).not.toContain('██╔═══██╗');
        expect(lastFrame()).toContain('>_ VivekMind');
    });
    it('displays the version number', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps }));
        expect(lastFrame()).toContain('v1.0.0');
    });
    it('displays auth type and model', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps }));
        expect(lastFrame()).toContain('VivekMind OAuth');
        expect(lastFrame()).toContain('qwen-coder-plus');
    });
    it('displays Coding Plan auth type', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps, authDisplayType: "Coding Plan" }));
        expect(lastFrame()).toContain('Coding Plan');
    });
    it('displays API Key auth type', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps, authDisplayType: "API Key" }));
        expect(lastFrame()).toContain('API Key');
    });
    it('displays Unknown when auth type is not set', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps, authDisplayType: undefined }));
        expect(lastFrame()).toContain('Unknown');
    });
    it('displays working directory', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps }));
        expect(lastFrame()).toContain('/home/user/projects/test');
    });
    it('renders without border around info panel', () => {
        const { lastFrame } = render(_jsx(Header, { ...defaultProps }));
        expect(lastFrame()).not.toContain('┌');
        expect(lastFrame()).not.toContain('┐');
    });
    it('renders plain text when NO_COLOR disables gradient colors', () => {
        process.env['NO_COLOR'] = '1';
        const { lastFrame } = render(_jsx(Header, { ...defaultProps }));
        expect(lastFrame()).toContain('██╔═══██╗');
    });
});
//# sourceMappingURL=Header.test.js.map