import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { MainContent } from './MainContent.js';
import { UIStateContext } from '../contexts/UIStateContext.js';
import { UIActionsContext, } from '../contexts/UIActionsContext.js';
import { AppContext } from '../contexts/AppContext.js';
import { CompactModeProvider } from '../contexts/CompactModeContext.js';
import { OverflowProvider } from '../contexts/OverflowContext.js';
const staticPropsSpy = vi.fn();
const staticItemsSpy = vi.fn();
const appHeaderSpy = vi.fn();
vi.mock('ink', async () => {
    const actual = await vi.importActual('ink');
    return {
        ...actual,
        Static: ({ children, items, ...props }) => {
            staticPropsSpy(props);
            staticItemsSpy(items);
            return _jsx(_Fragment, { children: items.map((item, index) => children(item, index)) });
        },
    };
});
vi.mock('./AppHeader.js', () => ({
    AppHeader: ({ version }) => {
        appHeaderSpy(version);
        return _jsx(Text, { children: `APP_HEADER:${version}` });
    },
}));
vi.mock('./HistoryItemDisplay.js', () => ({
    HistoryItemDisplay: ({ item }) => (_jsx(Text, { children: `HISTORY:${item.id}` })),
}));
vi.mock('./ShowMoreLines.js', () => ({
    ShowMoreLines: () => _jsx(Text, { children: "SHOW_MORE" }),
}));
vi.mock('./Notifications.js', () => ({
    Notifications: () => _jsx(Text, { children: "NOTIFICATIONS" }),
}));
vi.mock('./DebugModeNotification.js', () => ({
    DebugModeNotification: () => _jsx(Text, { children: "DEBUG_NOTIFICATION" }),
}));
const createUIState = (overrides = {}) => ({
    history: [],
    historyManager: {},
    isThemeDialogOpen: false,
    themeError: null,
    isAuthenticating: false,
    isConfigInitialized: true,
    authError: null,
    isAuthDialogOpen: false,
    pendingAuthType: undefined,
    externalAuthState: null,
    vivekmindAuthState: {},
    editorError: null,
    isEditorDialogOpen: false,
    debugMessage: '',
    quittingMessages: null,
    isSettingsDialogOpen: false,
    isMemoryDialogOpen: false,
    isModelDialogOpen: false,
    isFastModelMode: false,
    isManageModelsDialogOpen: false,
    isTrustDialogOpen: false,
    activeArenaDialog: null,
    isPermissionsDialogOpen: false,
    isApprovalModeDialogOpen: false,
    isResumeDialogOpen: false,
    resumeMatchedSessions: undefined,
    isDeleteDialogOpen: false,
    slashCommands: [],
    pendingSlashCommandHistoryItems: [],
    commandContext: {},
    shellConfirmationRequest: null,
    confirmationRequest: null,
    confirmUpdateExtensionRequests: [],
    codingPlanUpdateRequest: undefined,
    settingInputRequests: [],
    pluginChoiceRequests: [],
    loopDetectionConfirmationRequest: null,
    geminiMdFileCount: 0,
    streamingState: {},
    initError: null,
    pendingGeminiHistoryItems: [],
    thought: null,
    shellModeActive: false,
    userMessages: [],
    buffer: {},
    inputWidth: 80,
    suggestionsWidth: 80,
    isInputActive: true,
    shouldShowIdePrompt: false,
    shouldShowCommandMigrationNudge: false,
    commandMigrationTomlFiles: [],
    isFolderTrustDialogOpen: false,
    isTrustedFolder: true,
    constrainHeight: false,
    ideContextState: undefined,
    showToolDescriptions: false,
    ctrlCPressedOnce: false,
    ctrlDPressedOnce: false,
    showEscapePrompt: false,
    elapsedTime: 0,
    currentLoadingPhrase: '',
    historyRemountKey: 1,
    messageQueue: [],
    showAutoAcceptIndicator: {},
    currentModel: 'gpt-5.5',
    contextFileNames: [],
    availableTerminalHeight: undefined,
    mainAreaWidth: 100,
    staticAreaMaxItemHeight: 100,
    staticExtraHeight: 0,
    dialogsVisible: false,
    pendingHistoryItems: [],
    stickyTodos: null,
    btwItem: null,
    setBtwItem: vi.fn(),
    cancelBtw: vi.fn(),
    nightly: false,
    branchName: 'main',
    sessionStats: { lastPromptTokenCount: 0 },
    terminalWidth: 120,
    terminalHeight: 40,
    mainControlsRef: { current: null },
    currentIDE: null,
    updateInfo: null,
    showIdeRestartPrompt: false,
    ideTrustRestartReason: {},
    isRestarting: false,
    extensionsUpdateState: new Map(),
    activePtyId: undefined,
    embeddedShellFocused: false,
    showWelcomeBackDialog: false,
    welcomeBackInfo: null,
    welcomeBackChoice: null,
    isSubagentCreateDialogOpen: false,
    isAgentsManagerDialogOpen: false,
    isExtensionsManagerDialogOpen: false,
    isMcpDialogOpen: false,
    isHooksDialogOpen: false,
    isFeedbackDialogOpen: false,
    taskStartTokens: 0,
    streamingResponseLengthRef: { current: 0 },
    isReceivingContent: false,
    sessionName: null,
    setSessionName: vi.fn(),
    promptSuggestion: null,
    dismissPromptSuggestion: vi.fn(),
    isRewindSelectorOpen: false,
    rewindEscPending: false,
    ...overrides,
});
const createUIActions = () => ({
    refreshStatic: vi.fn(),
});
const renderMainContent = (uiState) => render(_jsx(AppContext.Provider, { value: { version: '1.2.3', startupWarnings: [] }, children: _jsx(CompactModeProvider, { value: { compactMode: false }, children: _jsx(UIActionsContext.Provider, { value: createUIActions(), children: _jsx(UIStateContext.Provider, { value: uiState, children: _jsx(OverflowProvider, { children: _jsx(MainContent, {}) }) }) }) }) }));
describe('<MainContent />', () => {
    it('renders AppHeader inside Static at the top of the static content', () => {
        staticPropsSpy.mockClear();
        staticItemsSpy.mockClear();
        appHeaderSpy.mockClear();
        const { lastFrame, rerender } = renderMainContent(createUIState({ currentModel: 'gpt-5.5', historyRemountKey: 7 }));
        expect(lastFrame()).toContain('APP_HEADER:1.2.3');
        expect(lastFrame()).toContain('DEBUG_NOTIFICATION');
        expect(lastFrame()).toContain('NOTIFICATIONS');
        expect(staticPropsSpy).toHaveBeenCalled();
        expect(staticItemsSpy).toHaveBeenLastCalledWith(expect.arrayContaining([
            expect.objectContaining({ key: 'app-header' }),
            expect.objectContaining({ key: 'debug-notification' }),
            expect.objectContaining({ key: 'notifications' }),
        ]));
        expect(staticItemsSpy.mock.calls.at(-1)?.[0]).toHaveLength(3);
        expect(appHeaderSpy).toHaveBeenCalledTimes(1);
        rerender(_jsx(AppContext.Provider, { value: { version: '1.2.3', startupWarnings: [] }, children: _jsx(CompactModeProvider, { value: { compactMode: false }, children: _jsx(UIActionsContext.Provider, { value: createUIActions(), children: _jsx(UIStateContext.Provider, { value: createUIState({
                            currentModel: 'gpt-5.4',
                            historyRemountKey: 7,
                        }), children: _jsx(OverflowProvider, { children: _jsx(MainContent, {}) }) }) }) }) }));
        expect(staticItemsSpy.mock.calls.at(-1)?.[0]).toHaveLength(3);
        expect(appHeaderSpy).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=MainContent.test.js.map