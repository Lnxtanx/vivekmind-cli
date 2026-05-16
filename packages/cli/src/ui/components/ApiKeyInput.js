import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from './shared/TextInput.js';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';
import { CodingPlanRegion } from '@vivekmind/core';
import Link from 'ink-link';
const CODING_PLAN_API_KEY_URL = 'https://bailian.console.aliyun.com/?tab=model#/efm/coding_plan';
const CODING_PLAN_INTL_API_KEY_URL = 'https://modelstudio.console.alibabacloud.com/?tab=dashboard#/efm/coding_plan';
export function ApiKeyInput({ onSubmit, onCancel, region = CodingPlanRegion.CHINA, }) {
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState(null);
    const apiKeyUrl = region === CodingPlanRegion.GLOBAL
        ? CODING_PLAN_INTL_API_KEY_URL
        : CODING_PLAN_API_KEY_URL;
    useKeypress((key) => {
        if (key.name === 'escape') {
            onCancel();
        }
        else if (key.name === 'return') {
            const trimmedKey = apiKey.trim();
            if (!trimmedKey) {
                setError(t('API key cannot be empty.'));
                return;
            }
            // Only validate sk-sp- prefix for China region (aliyun.com)
            if (region === CodingPlanRegion.CHINA &&
                !trimmedKey.startsWith('sk-sp-')) {
                setError(t('Invalid API key. Coding Plan API keys start with "sk-sp-". Please check.'));
                return;
            }
            onSubmit(trimmedKey);
        }
    }, { isActive: true });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(TextInput, { value: apiKey, onChange: setApiKey, placeholder: "sk-sp-..." }), error && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.status.error, children: error }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { children: t('You can get your Coding Plan API key here') }) }), _jsx(Box, { marginTop: 0, children: _jsx(Link, { url: apiKeyUrl, fallback: false, children: _jsx(Text, { color: theme.text.link, underline: true, children: apiKeyUrl }) }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.text.secondary, children: t('Enter to submit, Esc to go back') }) })] }));
}
//# sourceMappingURL=ApiKeyInput.js.map