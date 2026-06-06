import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { AuthType, ModelSlashCommandEvent, logModelSlashCommand, MAINLINE_CODER_MODEL, } from '@vivekmind/core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { UIStateContext } from '../contexts/UIStateContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import { t } from '../../i18n/index.js';
function formatModalities(modalities) {
    if (!modalities)
        return t('text-only');
    const parts = [];
    if (modalities.image)
        parts.push(t('image'));
    if (modalities.pdf)
        parts.push(t('pdf'));
    if (modalities.audio)
        parts.push(t('audio'));
    if (modalities.video)
        parts.push(t('video'));
    if (parts.length === 0)
        return t('text-only');
    return `${t('text')} · ${parts.join(' · ')}`;
}
function maskApiKey(apiKey) {
    if (!apiKey)
        return `(${t('not set')})`;
    const trimmed = apiKey.trim();
    if (trimmed.length === 0)
        return `(${t('not set')})`;
    if (trimmed.length <= 6)
        return '***';
    const head = trimmed.slice(0, 3);
    const tail = trimmed.slice(-4);
    return `${head}…${tail}`;
}
function persistModelSelection(settings, modelId) {
    const scope = getPersistScopeForModelSelection(settings);
    settings.setValue(scope, 'model.name', modelId);
}
function persistAuthTypeSelection(settings, authType) {
    const scope = getPersistScopeForModelSelection(settings);
    settings.setValue(scope, 'security.auth.selectedType', authType);
}
function handleModelSwitchSuccess({ settings, uiState, after, effectiveAuthType, effectiveModelId, isRuntime, }) {
    persistModelSelection(settings, effectiveModelId);
    if (effectiveAuthType) {
        persistAuthTypeSelection(settings, effectiveAuthType);
    }
    const baseUrl = after?.baseUrl ?? t('(default)');
    const maskedKey = maskApiKey(after?.apiKey);
    uiState?.historyManager.addItem({
        type: 'info',
        text: `authType: ${effectiveAuthType ?? `(${t('none')})`}` +
            `\n` +
            `Using ${isRuntime ? 'runtime ' : ''}model: ${effectiveModelId}` +
            `\n` +
            `Base URL: ${baseUrl}` +
            `\n` +
            `API key: ${maskedKey}`,
    }, Date.now());
}
function formatContextWindow(size) {
    if (!size)
        return `(${t('unknown')})`;
    return `${size.toLocaleString('en-US')} tokens`;
}
function DetailRow({ label, value, }) {
    return (_jsxs(Box, { children: [_jsx(Box, { minWidth: 16, flexShrink: 0, children: _jsxs(Text, { color: theme.text.secondary, children: [label, ":"] }) }), _jsx(Box, { flexGrow: 1, flexDirection: "row", flexWrap: "wrap", children: typeof value === 'string' ? (_jsx(Text, { children: value })) : (value) })] }));
}
const PROVIDER_NAME_MAP = {
    [AuthType.USE_OPENAI]: 'OpenAI',
    [AuthType.USE_ANTHROPIC]: 'Anthropic Claude',
    [AuthType.USE_GEMINI]: 'Google Gemini',
    [AuthType.USE_BEDROCK]: 'AWS Bedrock',
    [AuthType.USE_AZURE_OPENAI]: 'Azure OpenAI',
    [AuthType.USE_ANTHROPIC_VERTEX_AI]: 'Anthropic Vertex AI',
    [AuthType.USE_MISTRAL]: 'Mistral',
    [AuthType.USE_DEEPSEEK]: 'DeepSeek',
    [AuthType.USE_GROQ]: 'Groq',
    [AuthType.USE_DASHSCOPE]: 'DashScope (Alibaba)',
    [AuthType.USE_OLLAMA]: 'Ollama (Local)',
    [AuthType.USE_LM_STUDIO]: 'LM Studio (Local)',
    [AuthType.USE_OPENROUTER]: 'OpenRouter',
    [AuthType.USE_TOGETHER]: 'Together AI',
    [AuthType.USE_XAI]: 'xAI (Grok)',
    [AuthType.USE_COHERE]: 'Cohere',
    [AuthType.USE_PERPLEXITY]: 'Perplexity',
    [AuthType.USE_FIREWORKS]: 'Fireworks AI',
    [AuthType.USE_SILICONFLOW]: 'SiliconFlow',
    [AuthType.USE_HF]: 'Hugging Face',
    [AuthType.USE_NOVITA]: 'Novita AI',
    [AuthType.USE_WATSONX]: 'IBM Watsonx',
    [AuthType.VIVEKMIND_OAUTH]: 'VivekMind OAuth',
};
export function ModelDialog({ onClose, isFastModelMode, }) {
    const config = useContext(ConfigContext);
    const uiState = useContext(UIStateContext);
    const settings = useSettings();
    // Local error state for displaying errors within the dialog
    const [errorMessage, setErrorMessage] = useState(null);
    const [highlightedValue, setHighlightedValue] = useState(null);
    const authType = config?.getAuthType();
    const providerLabel = authType ? (PROVIDER_NAME_MAP[authType] || String(authType)) : t('(none)');
    const availableModelEntries = useMemo(() => {
        const allModels = config ? config.getAllConfiguredModels() : [];
        // Separate runtime models from registry models
        const runtimeModels = allModels.filter((m) => m.isRuntimeModel);
        const registryModels = allModels.filter((m) => !m.isRuntimeModel);
        // Group registry models by authType
        const modelsByAuthTypeMap = new Map();
        for (const model of registryModels) {
            const authType = model.authType;
            if (!modelsByAuthTypeMap.has(authType)) {
                modelsByAuthTypeMap.set(authType, []);
            }
            modelsByAuthTypeMap.get(authType).push(model);
        }
        // Build ordered list: runtime models first, then registry models for CURRENT authType ONLY
        const result = [];
        // Add all runtime models first (filtered by current authType)
        for (const runtimeModel of runtimeModels) {
            if (runtimeModel.authType === authType) {
                result.push({
                    authType: runtimeModel.authType,
                    model: runtimeModel,
                    isRuntime: true,
                    snapshotId: runtimeModel.runtimeSnapshotId,
                });
            }
        }
        // Add registry models for the current authType ONLY
        if (authType) {
            for (const model of modelsByAuthTypeMap.get(authType) ?? []) {
                result.push({ authType, model, isRuntime: false });
            }
        }
        return result;
    }, [config, authType]);
    const MODEL_OPTIONS = useMemo(() => availableModelEntries.map(({ authType: t2, model, isRuntime, snapshotId }) => {
        // Runtime models use snapshotId directly (format: $runtime|${authType}|${modelId})
        const value = isRuntime && snapshotId ? snapshotId : `${t2}::${model.id}`;
        const title = (_jsxs(Box, { flexDirection: "row", width: "100%", children: [_jsx(Box, { width: 30, children: _jsx(Text, { color: isRuntime
                            ? theme.status.warning
                            : 'white', children: model.label }) }), _jsx(Box, { flexGrow: 1, children: _jsx(Text, { color: theme.text.secondary, dimColor: true, wrap: "truncate", children: (model.description || '').slice(0, 40) }) })] }));
        return {
            value,
            title,
            description: '', // Description is already in the title layout
            key: value,
        };
    }), [availableModelEntries]);
    // In fast model mode, default to the currently configured fast model
    const fastModelSetting = settings?.merged?.fastModel;
    const preferredModelId = isFastModelMode && fastModelSetting
        ? fastModelSetting
        : config?.getModel() || MAINLINE_CODER_MODEL;
    // Check if current model is a runtime model
    // Runtime snapshot ID is already in $runtime|${authType}|${modelId} format
    const activeRuntimeSnapshot = isFastModelMode
        ? undefined // fast model is never a runtime model
        : config?.getActiveRuntimeModelSnapshot?.();
    const preferredKey = activeRuntimeSnapshot
        ? activeRuntimeSnapshot.id
        : authType
            ? `${authType}::${preferredModelId}`
            : '';
    useKeypress((key) => {
        if (key.name === 'escape' || (key.name === 'left' && isFastModelMode)) {
            onClose();
        }
    }, { isActive: true });
    const initialIndex = useMemo(() => {
        const index = MODEL_OPTIONS.findIndex((option) => option.value === preferredKey);
        return index === -1 ? 0 : index;
    }, [MODEL_OPTIONS, preferredKey]);
    const handleHighlight = useCallback((value) => {
        setHighlightedValue(value);
    }, []);
    const highlightedEntry = useMemo(() => {
        const key = highlightedValue ?? preferredKey;
        return availableModelEntries.find(({ authType: t2, model, isRuntime, snapshotId }) => {
            const v = isRuntime && snapshotId ? snapshotId : `${t2}::${model.id}`;
            return v === key;
        });
    }, [highlightedValue, preferredKey, availableModelEntries]);
    const handleSelect = useCallback(async (selected) => {
        setErrorMessage(null);
        // Fast model mode: just save the model ID and close
        if (isFastModelMode) {
            // Extract model ID from selection key (format: "authType::modelId" or "$runtime|authType|modelId")
            let modelId;
            if (selected.includes('::')) {
                modelId = selected.split('::').slice(1).join('::');
            }
            else if (selected.startsWith('$runtime|')) {
                const parts = selected.split('|');
                modelId = parts[2] ?? selected;
            }
            else {
                modelId = selected;
            }
            const scope = getPersistScopeForModelSelection(settings);
            settings.setValue(scope, 'fastModel', modelId);
            // Sync the runtime Config so forked agents pick up the change immediately.
            config?.setFastModel(modelId);
            uiState?.historyManager.addItem({
                type: 'success',
                text: `${t('Fast Model')}: ${modelId}`,
            }, Date.now());
            onClose();
            return;
        }
        // Block selection of discontinued vivekmind-oauth models
        // removed as vivekmind-oauth is completely removed
        let after;
        let effectiveAuthType;
        let effectiveModelId = selected;
        let isRuntime = false;
        if (!config) {
            onClose();
            return;
        }
        try {
            // Determine if this is a runtime model selection
            // Runtime model format: $runtime|${authType}|${modelId}
            isRuntime = selected.startsWith('$runtime|');
            let selectedAuthType;
            let modelId;
            if (isRuntime) {
                // For runtime models, extract authType from the snapshot ID
                // Format: $runtime|${authType}|${modelId}
                const parts = selected.split('|');
                if (parts.length >= 2 && parts[0] === '$runtime') {
                    selectedAuthType = parts[1];
                }
                else {
                    selectedAuthType = authType;
                }
                modelId = selected; // Pass the full snapshot ID to switchModel
            }
            else {
                const sep = '::';
                const idx = selected.indexOf(sep);
                selectedAuthType = (idx >= 0 ? selected.slice(0, idx) : authType);
                modelId = idx >= 0 ? selected.slice(idx + sep.length) : selected;
            }
            await config.switchModel(selectedAuthType, modelId, selectedAuthType !== authType &&
                selectedAuthType === AuthType.VIVEKMIND_OAUTH
                ? { requireCachedCredentials: true }
                : undefined);
            if (!isRuntime) {
                const event = new ModelSlashCommandEvent(modelId);
                logModelSlashCommand(config, event);
            }
            after = config.getContentGeneratorConfig?.();
            effectiveAuthType = after?.authType ?? selectedAuthType ?? authType;
            effectiveModelId = after?.model ?? modelId;
        }
        catch (e) {
            const baseErrorMessage = e instanceof Error ? e.message : String(e);
            const errorPrefix = isRuntime
                ? 'Failed to switch to runtime model.'
                : `Failed to switch model to '${effectiveModelId ?? selected}'.`;
            setErrorMessage(`${errorPrefix}\n\n${baseErrorMessage}`);
            return;
        }
        handleModelSwitchSuccess({
            settings,
            uiState,
            after,
            effectiveAuthType,
            effectiveModelId,
            isRuntime,
        });
        onClose();
    }, [
        authType,
        config,
        onClose,
        settings,
        uiState,
        setErrorMessage,
        isFastModelMode,
    ]);
    const hasModels = MODEL_OPTIONS.length > 0;
    return (_jsxs(Box, { borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%", children: [_jsx(Text, { bold: true, children: t('Select Model for {{providerLabel}}:', { providerLabel }) }), !hasModels ? (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { color: theme.status.warning, children: t('No models available for the current authentication type ({{authType}}).', {
                            authType: authType ? String(authType) : t('(none)'),
                        }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.text.secondary, children: t('Please configure models in settings.modelProviders or use environment variables.') }) })] })) : (_jsx(Box, { marginTop: 1, children: _jsx(DescriptiveRadioButtonSelect, { items: MODEL_OPTIONS, onSelect: handleSelect, onHighlight: handleHighlight, initialIndex: initialIndex, showNumbers: false }) })), highlightedEntry && (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Box, { borderStyle: "single", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false, borderColor: theme.border.default }), _jsx(DetailRow, { label: t('Modality'), value: formatModalities(highlightedEntry.model.modalities) }), _jsx(DetailRow, { label: t('Context Window'), value: formatContextWindow(highlightedEntry.model.contextWindowSize) }), _jsx(DetailRow, { label: "Base URL", value: highlightedEntry.model.baseUrl ?? t('(default)') }), _jsx(DetailRow, { label: "API Key", value: highlightedEntry.model.apiKey
                            ? `${maskApiKey(highlightedEntry.model.apiKey)} (${t('saved in config')})`
                            : (highlightedEntry.model.authType === AuthType.USE_BEDROCK ||
                                highlightedEntry.model.authType === AuthType.USE_VERTEX_AI ||
                                highlightedEntry.model.authType === AuthType.USE_ANTHROPIC_VERTEX_AI)
                                ? t('(using cloud credentials)')
                                : (highlightedEntry.model.envKey ?? t('(not set)')) })] })), errorMessage && (_jsx(Box, { marginTop: 1, flexDirection: "column", paddingX: 1, children: _jsxs(Text, { color: theme.status.error, wrap: "wrap", children: ["\u2715 ", errorMessage] }) })), _jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsx(Text, { color: theme.text.secondary, children: t('Enter to select  •  ↑↓ to navigate  •  Esc to close') }) })] }));
}
//# sourceMappingURL=ModelDialog.js.map