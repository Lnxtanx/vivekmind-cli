import { jsx as _jsx } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import { UIStateContext } from '../contexts/UIStateContext.js';
import { VimModeProvider } from '../contexts/VimModeContext.js';
import * as useTerminalSize from '../hooks/useTerminalSize.js';
vi.mock('../hooks/useTerminalSize.js');
const useTerminalSizeMock = vi.mocked(useTerminalSize.useTerminalSize);
const createSettings = (options) => ({
    merged: {
        ui: {
            hideTips: options?.hideTips ?? true,
        },
    },
});
const createMockConfig = (overrides = {}) => ({
    getContentGeneratorConfig: vi.fn(() => ({ authType: undefined })),
    getModel: vi.fn(() => 'gemini-pro'),
    getTargetDir: vi.fn(() => '/projects/vivekmind'),
    getMcpServers: vi.fn(() => ({})),
    getBlockedMcpServers: vi.fn(() => []),
    getDebugMode: vi.fn(() => false),
    getScreenReader: vi.fn(() => false),
    ...overrides,
});
const createMockUIState = (overrides = {}) => ({
    branchName: 'main',
    nightly: false,
    debugMessage: '',
    currentModel: 'gemini-pro',
    sessionStats: {
        lastPromptTokenCount: 0,
    },
    ...overrides,
});
const renderWithProviders = (uiState, settings = createSettings(), config = createMockConfig()) => {
    useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
    return render(_jsx(ConfigContext.Provider, { value: config, children: _jsx(SettingsContext.Provider, { value: settings, children: _jsx(VimModeProvider, { settings: settings, children: _jsx(UIStateContext.Provider, { value: uiState, children: _jsx(AppHeader, { version: "1.2.3" }) }) }) }) }));
};
describe('<AppHeader />', () => {
    it('shows the working directory', () => {
        const { lastFrame } = renderWithProviders(createMockUIState());
        expect(lastFrame()).toContain('/projects/vivekmind');
    });
    it('hides the header when screen reader is enabled', () => {
        const { lastFrame } = renderWithProviders(createMockUIState(), createSettings(), createMockConfig({ getScreenReader: vi.fn(() => true) }));
        // When screen reader is enabled, header is not rendered
        expect(lastFrame()).not.toContain('/projects/vivekmind');
        expect(lastFrame()).not.toContain('VivekMind');
    });
    it('shows the header with all info when banner is visible', () => {
        const { lastFrame } = renderWithProviders(createMockUIState());
        expect(lastFrame()).toContain('>_ VivekMind');
        expect(lastFrame()).toContain('gemini-pro');
        expect(lastFrame()).toContain('/projects/vivekmind');
    });
});
//# sourceMappingURL=AppHeader.test.js.map