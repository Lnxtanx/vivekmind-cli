import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { AuthType, } from '@vivekmind/core';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from '../components/shared/DescriptiveRadioButtonSelect.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { t } from '../../i18n/index.js';
export function AuthDialog() {
    const { authError } = useUIState();
    const uiActions = useUIActions();
    const { handleAuthSelect: onAuthSelect, handleCustomApiKeySubmit, onAuthError, setPendingAuthType, refreshStatic, } = uiActions;
    const [errorMessage, setErrorMessage] = useState(null);
    const [viewLevel, setViewLevel] = useState('main');
    const [formStep, setFormStep] = useState(0);
    const [selectedProviderLabel, setSelectedProviderLabel] = useState('');
    // Custom API Key state
    const [customProtocol, setCustomProtocol] = useState(AuthType.USE_OPENAI);
    const [customBaseUrl, setCustomBaseUrl] = useState('');
    const [customApiKey, setCustomApiKey] = useState('');
    const [customModelIds, setCustomModelIds] = useState('');
    // Bedrock specific state
    const [awsAccessKey, setCustomAwsAccessKey] = useState('');
    const [awsSecretKey, setCustomAwsSecretKey] = useState('');
    const [awsRegion, setCustomAwsRegion] = useState('us-east-1');
    // Handle back navigation
    useKeypress((key) => {
        if (key.name === 'escape') {
            if (viewLevel !== 'main') {
                if (formStep > 0) {
                    setFormStep(formStep - 1);
                    setErrorMessage(null);
                }
                else {
                    setViewLevel('main');
                    setErrorMessage(null);
                    setPendingAuthType(undefined);
                    refreshStatic();
                }
            }
        }
    }, { isActive: true });
    // Vertex / Watsonx specific state
    const [projectId, setProjectId] = useState('');
    const [location, setLocation] = useState('us-central1');
    // Categorized and sorted providers
    const mainItems = [
        // --- Direct Cloud API ---
        { key: 'OPENAI', label: 'OpenAI', value: AuthType.USE_OPENAI },
        { key: 'ANTHROPIC', label: 'Anthropic Claude', value: AuthType.USE_ANTHROPIC },
        { key: 'GEMINI', label: 'Google Gemini', value: AuthType.USE_GEMINI },
        { key: 'MISTRAL', label: 'Mistral', value: AuthType.USE_MISTRAL },
        { key: 'DEEPSEEK', label: 'DeepSeek', value: AuthType.USE_DEEPSEEK },
        { key: 'XAI', label: 'xAI (Grok)', value: AuthType.USE_XAI },
        { key: 'GROQ', label: 'Groq', value: AuthType.USE_GROQ },
        { key: 'DASHSCOPE', label: 'DashScope (Alibaba)', value: AuthType.USE_DASHSCOPE },
        { key: 'COHERE', label: 'Cohere', value: AuthType.USE_COHERE },
        { key: 'PERPLEXITY', label: 'Perplexity', value: AuthType.USE_PERPLEXITY },
        { key: 'SILICONFLOW', label: 'SiliconFlow', value: AuthType.USE_SILICONFLOW },
        { key: 'NOVITA', label: 'Novita AI', value: AuthType.USE_NOVITA },
        { key: 'HUGGING_FACE', label: 'Hugging Face', value: AuthType.USE_HF },
        // --- Enterprise Cloud ---
        { key: 'BEDROCK', label: 'AWS Bedrock', value: AuthType.USE_BEDROCK },
        { key: 'AZURE', label: 'Azure OpenAI', value: AuthType.USE_AZURE_OPENAI },
        { key: 'GOOGLE_VERTEX', label: 'Google Vertex AI', value: AuthType.USE_VERTEX_AI },
        { key: 'VERTEX', label: 'Anthropic Vertex AI', value: AuthType.USE_ANTHROPIC_VERTEX_AI },
        { key: 'WATSONX', label: 'IBM Watsonx', value: AuthType.USE_WATSONX },
        // --- Aggregators ---
        { key: 'OPENROUTER', label: 'OpenRouter', value: AuthType.USE_OPENROUTER },
        { key: 'TOGETHER', label: 'Together AI', value: AuthType.USE_TOGETHER },
        { key: 'FIREWORKS', label: 'Fireworks AI', value: AuthType.USE_FIREWORKS },
        // --- Local ---
        { key: 'OLLAMA', label: 'Ollama (Local)', value: AuthType.USE_OLLAMA },
        { key: 'LM_STUDIO', label: 'LM Studio (Local)', value: AuthType.USE_LM_STUDIO },
        // --- Special ---
        { key: 'VIVEKMIND_OAUTH', label: 'VivekMind OAuth', value: AuthType.VIVEKMIND_OAUTH },
    ];
    const PROVIDER_BASE_URLS = {
        [AuthType.USE_OPENAI]: 'https://api.openai.com/v1',
        [AuthType.USE_ANTHROPIC]: 'https://api.anthropic.com/v1',
        [AuthType.USE_GEMINI]: '', // Use SDK defaults to avoid path mismatches (404)
        [AuthType.USE_VERTEX_AI]: '', // Use SDK defaults
        [AuthType.USE_ANTHROPIC_VERTEX_AI]: '', // Use SDK defaults
        [AuthType.USE_AZURE_OPENAI]: 'https://YOUR_RESOURCE_NAME.openai.azure.com',
        [AuthType.USE_BEDROCK]: '', // Uses AWS credentials
        [AuthType.USE_OLLAMA]: 'http://localhost:11434/v1',
        [AuthType.USE_LM_STUDIO]: 'http://localhost:1234/v1',
        [AuthType.USE_GROQ]: 'https://api.groq.com/openai/v1',
        [AuthType.USE_MISTRAL]: 'https://api.mistral.ai/v1',
        [AuthType.USE_DEEPSEEK]: 'https://api.deepseek.com/v1',
        [AuthType.USE_TOGETHER]: 'https://api.together.xyz/v1',
        [AuthType.USE_OPENROUTER]: 'https://openrouter.ai/api/v1',
        [AuthType.USE_XAI]: 'https://api.x.ai/v1',
        [AuthType.USE_DASHSCOPE]: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        [AuthType.USE_COHERE]: 'https://api.cohere.com/v1',
        [AuthType.USE_PERPLEXITY]: 'https://api.perplexity.ai',
        [AuthType.USE_FIREWORKS]: 'https://api.fireworks.ai/inference/v1',
        [AuthType.USE_SILICONFLOW]: 'https://api.siliconflow.cn/v1',
        [AuthType.USE_HF]: 'https://api-inference.huggingface.co/models',
        [AuthType.USE_NOVITA]: 'https://api.novita.ai/v3',
        [AuthType.USE_WATSONX]: 'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation',
    };
    const PROVIDER_DEFAULT_MODELS = {
        [AuthType.USE_OPENAI]: 'gpt-5.2,gpt-5.4-mini,gpt-4.1,gpt-4o,o3',
        [AuthType.USE_ANTHROPIC]: 'claude-opus-4-7,claude-sonnet-4-6,claude-haiku-4-5-20251001',
        [AuthType.USE_GEMINI]: 'gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-pro,gemini-1.0-pro',
        [AuthType.USE_VERTEX_AI]: 'gemini-3-pro,gemini-2.5-pro,gemini-2.5-flash',
        [AuthType.USE_ANTHROPIC_VERTEX_AI]: 'claude-opus-4-7,claude-sonnet-4-6,claude-haiku-4-5-20251001',
        [AuthType.USE_AZURE_OPENAI]: 'gpt-5.2,gpt-4.1,gpt-4o,o3',
        [AuthType.USE_BEDROCK]: 'anthropic.claude-opus-4-7,anthropic.claude-sonnet-4-6,anthropic.claude-haiku-4-5-20251001-v1:0,qwen.qwen3-coder-next,qwen.qwen3-coder-30b-a3b-v1:0,deepseek.v3.2,deepseek.r1-v1:0,zai.glm-5,zai.glm-4.7,mistral.devstral-2-123b,mistral.mistral-large-3-675b-instruct,amazon.nova-pro-v1:0,amazon.nova-2-sonic-v1:0,meta.llama4-maverick-17b-instruct-v1:0,meta.llama4-scout-17b-instruct-v1:0,nvidia.nemotron-super-3-120b,moonshotai.kimi-k2.5',
        [AuthType.USE_OLLAMA]: 'llama3.3:70b,qwen2.5-coder:32b,deepseek-r1:70b',
        [AuthType.USE_LM_STUDIO]: 'loaded-model',
        [AuthType.USE_GROQ]: 'llama-3.3-70b-versatile,llama-3.1-8b-instant,deepseek-r1-distill-llama-70b',
        [AuthType.USE_MISTRAL]: 'mistral-large-2411,codestral-2505,pixtral-large-2502',
        [AuthType.USE_DEEPSEEK]: 'deepseek-chat,deepseek-reasoner,deepseek-coder',
        [AuthType.USE_TOGETHER]: 'meta-llama/Llama-3.3-70B-Instruct-Turbo,deepseek-ai/DeepSeek-V3,Qwen/Qwen3-235B-A22B',
        [AuthType.USE_OPENROUTER]: 'anthropic/claude-opus-4-7,openai/gpt-5.2,google/gemini-3-pro,deepseek/deepseek-r1',
        [AuthType.USE_XAI]: 'grok-4,grok-4-fast',
        [AuthType.USE_DASHSCOPE]: 'qwen3-coder-plus,qwen-max,qwen-vl-max',
        [AuthType.USE_COHERE]: 'command-r-plus,command-r',
        [AuthType.USE_PERPLEXITY]: 'sonar-pro,sonar-reasoning-pro',
        [AuthType.USE_FIREWORKS]: 'accounts/fireworks/models/llama4-maverick-instruct-basic,accounts/fireworks/models/deepseek-v3',
        [AuthType.USE_SILICONFLOW]: 'deepseek-ai/DeepSeek-V3,Qwen/Qwen3-235B-A22B,meta-llama/Meta-Llama-3.1-405B-Instruct',
        [AuthType.USE_HF]: 'meta-llama/Llama-3.3-70B-Instruct,mistralai/Mistral-Large-2411',
        [AuthType.USE_NOVITA]: 'meta-llama/llama-3.1-70b-instruct,deepseek/deepseek-v3',
        [AuthType.USE_WATSONX]: 'meta-llama/llama-4-maverick-instruct,ibm/granite-34b-code-instruct',
    };
    const handleMainSelect = async (value) => {
        setErrorMessage(null);
        onAuthError(null);
        const selectedItem = mainItems.find(item => item.value === value);
        const selectedAuthType = value;
        const label = selectedItem?.label || 'API Key';
        setSelectedProviderLabel(label);
        setPendingAuthType(selectedAuthType);
        refreshStatic(); // Update header immediately
        if (selectedAuthType === AuthType.USE_BEDROCK) {
            // Check if credentials exist in env first
            if (process.env['AWS_ACCESS_KEY_ID'] && process.env['AWS_SECRET_ACCESS_KEY']) {
                setErrorMessage(t('Using credentials from environment variables ✓'));
                setTimeout(() => {
                    void onAuthSelect(AuthType.USE_BEDROCK);
                }, 1000);
                return;
            }
            // Otherwise, switch to manual input wizard
            setViewLevel('bedrock-credentials-input');
            setFormStep(0);
            if (PROVIDER_DEFAULT_MODELS[AuthType.USE_BEDROCK]) {
                setCustomModelIds(PROVIDER_DEFAULT_MODELS[AuthType.USE_BEDROCK]);
            }
            return;
        }
        if (selectedAuthType === AuthType.USE_AZURE_OPENAI) {
            setViewLevel('api-key-input');
            setFormStep(0); // 0: API Key, 1: Endpoint
            setCustomProtocol(selectedAuthType);
            setCustomBaseUrl(PROVIDER_BASE_URLS[selectedAuthType] || '');
            setCustomModelIds(PROVIDER_DEFAULT_MODELS[selectedAuthType] || '');
            return;
        }
        if (selectedAuthType === AuthType.USE_WATSONX) {
            setViewLevel('api-key-input');
            setFormStep(0); // 0: API Key, 1: Project ID, 2: URL
            setCustomProtocol(selectedAuthType);
            setCustomBaseUrl(PROVIDER_BASE_URLS[selectedAuthType] || '');
            setCustomModelIds(PROVIDER_DEFAULT_MODELS[selectedAuthType] || '');
            return;
        }
        if (selectedAuthType === AuthType.USE_VERTEX_AI || selectedAuthType === AuthType.USE_ANTHROPIC_VERTEX_AI) {
            setViewLevel('api-key-input');
            setFormStep(0); // 0: Project ID, 1: Location
            setCustomProtocol(selectedAuthType);
            setCustomModelIds(PROVIDER_DEFAULT_MODELS[selectedAuthType] || '');
            return;
        }
        if (selectedAuthType === AuthType.VIVEKMIND_OAUTH) {
            void onAuthSelect(AuthType.VIVEKMIND_OAUTH);
            return;
        }
        // Local providers that don't need an API key
        if (selectedAuthType === AuthType.USE_OLLAMA || selectedAuthType === AuthType.USE_LM_STUDIO) {
            setErrorMessage(t('✓ {{label}} detected — using local models', { label }));
            setTimeout(async () => {
                await handleCustomApiKeySubmit(selectedAuthType, PROVIDER_BASE_URLS[selectedAuthType], 'local-provider', PROVIDER_DEFAULT_MODELS[selectedAuthType]);
            }, 1000);
            return;
        }
        setViewLevel('api-key-input');
        setCustomProtocol(selectedAuthType);
        if (PROVIDER_BASE_URLS[selectedAuthType]) {
            setCustomBaseUrl(PROVIDER_BASE_URLS[selectedAuthType]);
        }
        if (PROVIDER_DEFAULT_MODELS[selectedAuthType]) {
            setCustomModelIds(PROVIDER_DEFAULT_MODELS[selectedAuthType]);
        }
    };
    return (_jsxs(Box, { flexDirection: "column", width: "100%", children: [viewLevel === 'main' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, children: t('Select Provider:') }) }), _jsx(DescriptiveRadioButtonSelect, { items: mainItems.map(item => ({ ...item, title: item.label, description: '' })), initialIndex: 0, onSelect: handleMainSelect, itemGap: 0, maxItemsToShow: 15 }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.text.secondary, children: "\u2191\u2193 to navigate  \u2022  Enter to select  \u2022  ? for shortcuts" }) })] })), viewLevel === 'api-key-input' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, children: t('Setup {{label}}:', { label: selectedProviderLabel }) }) }), formStep === 0 && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "white", children: customProtocol === AuthType.USE_VERTEX_AI || customProtocol === AuthType.USE_ANTHROPIC_VERTEX_AI
                                    ? t('Google Cloud Project ID:')
                                    : t('Enter API Key:') }), _jsx(TextInput, { value: customApiKey, onChange: setCustomApiKey, isActive: true, onSubmit: () => {
                                    if (!customApiKey.trim()) {
                                        setErrorMessage(customProtocol === AuthType.USE_VERTEX_AI || customProtocol === AuthType.USE_ANTHROPIC_VERTEX_AI
                                            ? t('Project ID cannot be empty.')
                                            : t('API key cannot be empty.'));
                                        return;
                                    }
                                    if (customProtocol === AuthType.USE_AZURE_OPENAI ||
                                        customProtocol === AuthType.USE_WATSONX ||
                                        customProtocol === AuthType.USE_VERTEX_AI ||
                                        customProtocol === AuthType.USE_ANTHROPIC_VERTEX_AI) {
                                        setFormStep(1);
                                    }
                                    else {
                                        // Direct submission for single-field providers
                                        void handleCustomApiKeySubmit(customProtocol, customBaseUrl, customApiKey, customModelIds);
                                    }
                                }, placeholder: customProtocol === AuthType.USE_VERTEX_AI || customProtocol === AuthType.USE_ANTHROPIC_VERTEX_AI
                                    ? 'my-project-id'
                                    : 'sk-...' })] })), formStep === 1 && (_jsx(Box, { flexDirection: "column", children: customProtocol === AuthType.USE_AZURE_OPENAI ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: "white", children: t('Azure Endpoint URL:') }), _jsx(TextInput, { value: customBaseUrl, onChange: setCustomBaseUrl, isActive: true, onSubmit: () => {
                                        if (!customBaseUrl.trim()) {
                                            setErrorMessage(t('Endpoint URL cannot be empty.'));
                                            return;
                                        }
                                        void handleCustomApiKeySubmit(customProtocol, customBaseUrl, customApiKey, customModelIds);
                                    }, placeholder: "https://resource.openai.azure.com" })] })) : customProtocol === AuthType.USE_VERTEX_AI || customProtocol === AuthType.USE_ANTHROPIC_VERTEX_AI ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: "white", children: t('Google Cloud Location (Region):') }), _jsx(TextInput, { value: location, onChange: setLocation, isActive: true, onSubmit: async () => {
                                        if (!location.trim()) {
                                            setErrorMessage(t('Location cannot be empty.'));
                                            return;
                                        }
                                        // Use a dedicated handler for Vertex to store Project ID and Location
                                        await uiActions.handleVertexCredentialsSubmit(customProtocol, customApiKey, // This is Project ID for Vertex
                                        location, customModelIds);
                                    }, placeholder: "us-central1" })] })) : (_jsxs(_Fragment, { children: [_jsx(Text, { color: "white", children: t('Watsonx Project ID:') }), _jsx(TextInput, { value: projectId, onChange: setProjectId, isActive: true, onSubmit: () => {
                                        if (!projectId.trim()) {
                                            setErrorMessage(t('Project ID cannot be empty.'));
                                            return;
                                        }
                                        setFormStep(2);
                                    }, placeholder: "project-id-..." })] })) })), formStep === 2 && customProtocol === AuthType.USE_WATSONX && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "white", children: t('Watsonx API URL:') }), _jsx(TextInput, { value: customBaseUrl, onChange: setCustomBaseUrl, isActive: true, onSubmit: () => {
                                    if (!customBaseUrl.trim()) {
                                        setErrorMessage(t('URL cannot be empty.'));
                                        return;
                                    }
                                    void handleCustomApiKeySubmit(customProtocol, customBaseUrl, customApiKey, customModelIds, {
                                        extra_body: { project_id: projectId }
                                    });
                                }, placeholder: "https://us-south.ml.cloud.ibm.com" })] })), _jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsx(Text, { color: theme.text.secondary, children: t('Press Enter to continue, Esc to go back') }) })] })), viewLevel === 'bedrock-credentials-input' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, children: t('Setup AWS Bedrock Credentials:') }) }), formStep === 0 && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "white", children: t('AWS Access Key ID:') }), _jsx(TextInput, { value: awsAccessKey, onChange: setCustomAwsAccessKey, isActive: true, placeholder: "AKIA...", onSubmit: () => {
                                    if (!awsAccessKey.trim()) {
                                        setErrorMessage(t('Access Key is required.'));
                                        return;
                                    }
                                    setFormStep(1);
                                } })] })), formStep === 1 && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "white", children: t('AWS Secret Access Key:') }), _jsx(TextInput, { value: awsSecretKey, onChange: setCustomAwsSecretKey, isActive: true, placeholder: "SECRET...", onSubmit: () => {
                                    if (!awsSecretKey.trim()) {
                                        setErrorMessage(t('Secret Key is required.'));
                                        return;
                                    }
                                    setFormStep(2);
                                } })] })), formStep === 2 && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "white", children: t('AWS Region:') }), _jsx(TextInput, { value: awsRegion, onChange: setCustomAwsRegion, isActive: true, placeholder: "us-east-1", onSubmit: async () => {
                                    if (!awsRegion.trim()) {
                                        setErrorMessage(t('Region is required.'));
                                        return;
                                    }
                                    await uiActions.handleBedrockCredentialsSubmit(awsAccessKey, awsSecretKey, awsRegion, customModelIds);
                                } })] })), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { color: theme.text.secondary, children: formStep < 2 ? t('Press Enter to continue') : t('Press Enter to finish') }), _jsx(Text, { color: theme.text.secondary, children: t('Esc to go back') })] })] })), (authError || errorMessage) && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: errorMessage?.includes('\u2713') ? theme.status.success : theme.status.error, children: authError || errorMessage }) }))] }));
}
//# sourceMappingURL=AuthDialog.js.map