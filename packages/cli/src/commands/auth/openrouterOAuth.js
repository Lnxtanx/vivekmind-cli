/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import open from 'open';
import { AuthType, } from '@vivekmind/core';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
export const OPENROUTER_ENV_KEY = 'OPENROUTER_API_KEY';
export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_OAUTH_AUTHORIZE_URL = 'https://openrouter.ai/auth';
export const OPENROUTER_OAUTH_EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys';
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const OPENROUTER_OAUTH_CALLBACK_URL = 'http://localhost:3000/openrouter/callback';
const OPENROUTER_CODE_CHALLENGE_METHOD = 'S256';
const OPENROUTER_OAUTH_TIMEOUT_MS = 5 * 60 * 1000;
const OPENROUTER_MINIMUM_TEXT_MODELS = 1;
export const OPENROUTER_DEFAULT_MODELS = [
    {
        id: 'openai/gpt-4o-mini',
        name: 'OpenRouter · GPT-4o mini',
        baseUrl: OPENROUTER_BASE_URL,
        envKey: OPENROUTER_ENV_KEY,
    },
    {
        id: 'anthropic/claude-3.7-sonnet',
        name: 'OpenRouter · Claude 3.7 Sonnet',
        baseUrl: OPENROUTER_BASE_URL,
        envKey: OPENROUTER_ENV_KEY,
    },
    {
        id: 'google/gemini-2.5-flash',
        name: 'OpenRouter · Gemini 2.5 Flash',
        baseUrl: OPENROUTER_BASE_URL,
        envKey: OPENROUTER_ENV_KEY,
    },
];
function toBase64Url(input) {
    return input
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
export function createPkcePair() {
    const codeVerifier = toBase64Url(randomBytes(32));
    const codeChallenge = toBase64Url(createHash('sha256').update(codeVerifier).digest());
    return { codeVerifier, codeChallenge };
}
export function buildOpenRouterAuthorizationUrl(params) {
    const url = new URL(OPENROUTER_OAUTH_AUTHORIZE_URL);
    url.searchParams.set('callback_url', params.callbackUrl);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge_method', params.codeChallengeMethod || OPENROUTER_CODE_CHALLENGE_METHOD);
    if (typeof params.limit === 'number') {
        url.searchParams.set('limit', String(params.limit));
    }
    return url.toString();
}
export function createOAuthState() {
    return toBase64Url(randomBytes(32));
}
export function createOpenRouterOAuthSession(callbackUrl = OPENROUTER_OAUTH_CALLBACK_URL, pkcePair = createPkcePair(), state = createOAuthState()) {
    return {
        callbackUrl,
        codeVerifier: pkcePair.codeVerifier,
        state,
        authorizationUrl: buildOpenRouterAuthorizationUrl({
            callbackUrl,
            codeChallenge: pkcePair.codeChallenge,
            state,
            codeChallengeMethod: OPENROUTER_CODE_CHALLENGE_METHOD,
        }),
    };
}
export function startOAuthCallbackListener(callbackUrl = OPENROUTER_OAUTH_CALLBACK_URL, timeoutMs = OPENROUTER_OAUTH_TIMEOUT_MS, expectedState) {
    const parsedUrl = new URL(callbackUrl);
    if (parsedUrl.protocol !== 'http:') {
        throw new Error('Only http localhost callback URLs are currently supported.');
    }
    let server;
    let timeout;
    let settled = false;
    const close = async () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        if (!server) {
            return;
        }
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
        server = undefined;
    };
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });
    let resolveCode;
    let rejectCode;
    const waitForCode = new Promise((resolve, reject) => {
        resolveCode = resolve;
        rejectCode = reject;
    });
    const finish = (action, payload) => {
        if (settled) {
            return;
        }
        settled = true;
        if (action === 'resolve') {
            resolveCode(payload);
        }
        else {
            rejectCode(payload);
        }
        void close().catch(() => undefined);
    };
    server = createServer((req, res) => {
        const requestUrl = new URL(req.url || '/', parsedUrl.origin);
        if (requestUrl.pathname !== parsedUrl.pathname) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }
        const error = requestUrl.searchParams.get('error');
        if (error) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(`OpenRouter authorization failed: ${error}`);
            void finish('reject', new Error(`OpenRouter authorization failed: ${error}`));
            return;
        }
        const callbackState = requestUrl.searchParams.get('state');
        if (expectedState && callbackState !== expectedState) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Invalid OAuth state.');
            void finish('reject', new Error('Invalid OAuth state from OpenRouter callback.'));
            return;
        }
        const code = requestUrl.searchParams.get('code');
        if (!code) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Missing authorization code.');
            void finish('reject', new Error('Missing authorization code from OpenRouter callback.'));
            return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<html><body><h1>OpenRouter authentication complete.</h1><p>You can return to VivekMind.</p></body></html>');
        void finish('resolve', code);
    });
    server.once('error', (error) => {
        rejectReady(error instanceof Error ? error : new Error(String(error)));
        void finish('reject', error instanceof Error ? error : new Error(String(error)));
    });
    const port = parsedUrl.port ? Number(parsedUrl.port) : 80;
    server.listen(port, parsedUrl.hostname, () => {
        resolveReady();
    });
    timeout = setTimeout(() => {
        void finish('reject', new Error('Timed out waiting for OpenRouter OAuth callback.'));
    }, timeoutMs);
    return {
        ready,
        waitForCode,
        close,
    };
}
function buildOpenRouterHeaders() {
    return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Lnxtanx/vivekmind-cli.git',
        'X-OpenRouter-Title': 'VivekMind',
    };
}
const OPENROUTER_MODEL_PRIORITY_PREFIXES = ['qwen/', 'glm/', 'minimax/'];
const OPENROUTER_RECOMMENDED_MODEL_LIMIT = 16;
const OPENROUTER_FREE_MODEL_ID_HINT = ':free';
export function getPreferredOpenRouterModelId(models) {
    return (models.find((model) => model.id === OPENROUTER_DEFAULT_MODEL)?.id ||
        models[0]?.id);
}
function isOpenRouterFreeModelId(modelId) {
    const normalizedId = modelId.toLowerCase();
    return (normalizedId.includes(OPENROUTER_FREE_MODEL_ID_HINT) ||
        normalizedId === 'openrouter/free');
}
function getOpenRouterModelPriority(modelId) {
    const normalizedId = modelId.toLowerCase();
    const matchedIndex = OPENROUTER_MODEL_PRIORITY_PREFIXES.findIndex((prefix) => normalizedId.startsWith(prefix));
    return matchedIndex === -1
        ? OPENROUTER_MODEL_PRIORITY_PREFIXES.length
        : matchedIndex;
}
function isOpenRouterFreeConfig(model) {
    return isOpenRouterFreeModelId(model.id);
}
function compareOpenRouterModels(a, b) {
    const freeDiff = Number(isOpenRouterFreeConfig(b)) - Number(isOpenRouterFreeConfig(a));
    if (freeDiff !== 0) {
        return freeDiff;
    }
    const priorityDiff = getOpenRouterModelPriority(a.id) - getOpenRouterModelPriority(b.id);
    if (priorityDiff !== 0) {
        return priorityDiff;
    }
    return a.id.localeCompare(b.id);
}
function toOpenRouterModelConfig(model) {
    if (!model.id) {
        return null;
    }
    const outputModalities = model.architecture?.output_modalities || [];
    const supportsTextOutput = outputModalities.length
        ? outputModalities.includes('text')
        : true;
    if (!supportsTextOutput) {
        return null;
    }
    const inputModalities = model.architecture?.input_modalities || [];
    const supportsVision = inputModalities.includes('image');
    return {
        id: model.id,
        name: model.name
            ? `OpenRouter · ${model.name}`
            : `OpenRouter · ${model.id}`,
        baseUrl: OPENROUTER_BASE_URL,
        envKey: OPENROUTER_ENV_KEY,
        capabilities: supportsVision ? { vision: true } : undefined,
        generationConfig: typeof model.context_length === 'number'
            ? { contextWindowSize: model.context_length }
            : undefined,
    };
}
function chooseRepresentativeModel(models, predicate, selectedIds) {
    return models.find((model) => predicate(model) && !selectedIds.has(model.id));
}
function addRecommendedModel(target, model, selectedIds, limit) {
    if (!model || selectedIds.has(model.id) || target.length >= limit) {
        return;
    }
    target.push(model);
    selectedIds.add(model.id);
}
export function selectRecommendedOpenRouterModels(models, limit = OPENROUTER_RECOMMENDED_MODEL_LIMIT) {
    if (models.length <= limit) {
        return models;
    }
    const sorted = [...models].sort(compareOpenRouterModels);
    const recommended = [];
    const selectedIds = new Set();
    const freeModels = sorted.filter((model) => isOpenRouterFreeConfig(model));
    for (const model of freeModels.slice(0, Math.min(limit, 6))) {
        addRecommendedModel(recommended, model, selectedIds, limit);
    }
    for (const prefix of OPENROUTER_MODEL_PRIORITY_PREFIXES) {
        addRecommendedModel(recommended, chooseRepresentativeModel(sorted, (model) => model.id.toLowerCase().startsWith(prefix), selectedIds), selectedIds, limit);
    }
    for (const family of ['anthropic/', 'google/', 'openai/']) {
        addRecommendedModel(recommended, chooseRepresentativeModel(sorted, (model) => model.id.toLowerCase().startsWith(family), selectedIds), selectedIds, limit);
    }
    addRecommendedModel(recommended, chooseRepresentativeModel(sorted, (model) => model.capabilities?.vision === true, selectedIds), selectedIds, limit);
    addRecommendedModel(recommended, chooseRepresentativeModel(sorted, (model) => (model.generationConfig?.contextWindowSize || 0) >= 1000000, selectedIds), selectedIds, limit);
    for (const model of sorted) {
        if (recommended.length >= limit) {
            break;
        }
        addRecommendedModel(recommended, model, selectedIds, limit);
    }
    return recommended;
}
export function isOpenRouterConfig(config) {
    return (config.baseUrl || '').includes('openrouter.ai');
}
export function mergeOpenRouterConfigs(existingConfigs, openRouterModels = OPENROUTER_DEFAULT_MODELS) {
    const nonOpenRouterConfigs = existingConfigs.filter((existing) => !isOpenRouterConfig(existing));
    return [...openRouterModels, ...nonOpenRouterConfigs];
}
export async function applyOpenRouterModelsConfiguration(params) {
    const { settings, config, apiKey, reloadConfig } = params;
    const persistScope = getPersistScopeForModelSelection(settings);
    settings.setValue(persistScope, `env.${OPENROUTER_ENV_KEY}`, apiKey);
    process.env[OPENROUTER_ENV_KEY] = apiKey;
    const existingConfigs = settings.merged.modelProviders?.[AuthType.USE_OPENAI] || [];
    const openRouterCatalog = await getOpenRouterModelsWithFallback();
    const openRouterModels = selectRecommendedOpenRouterModels(openRouterCatalog);
    const updatedConfigs = mergeOpenRouterConfigs(existingConfigs, openRouterModels);
    settings.setValue(persistScope, `modelProviders.${AuthType.USE_OPENAI}`, updatedConfigs);
    settings.setValue(persistScope, 'security.auth.selectedType', AuthType.USE_OPENAI);
    const activeModelId = getPreferredOpenRouterModelId(updatedConfigs);
    if (activeModelId) {
        settings.setValue(persistScope, 'model.name', activeModelId);
    }
    if (reloadConfig) {
        const updatedModelProviders = {
            ...settings.merged.modelProviders,
            [AuthType.USE_OPENAI]: updatedConfigs,
        };
        config.reloadModelProvidersConfig(updatedModelProviders);
    }
    return {
        updatedConfigs,
        activeModelId,
        persistScope,
    };
}
export async function fetchOpenRouterModels() {
    const response = await fetch(OPENROUTER_MODELS_URL, {
        method: 'GET',
        headers: buildOpenRouterHeaders(),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter models request failed (${response.status}): ${errorText}`);
    }
    const data = (await response.json());
    const records = Array.isArray(data.data) ? data.data : [];
    const models = records
        .map((record) => toOpenRouterModelConfig(record))
        .filter((model) => model !== null)
        .sort(compareOpenRouterModels);
    if (models.length < OPENROUTER_MINIMUM_TEXT_MODELS) {
        throw new Error('OpenRouter models request returned no usable text models.');
    }
    return models;
}
export async function getOpenRouterModelsWithFallback() {
    try {
        return await fetchOpenRouterModels();
    }
    catch {
        return OPENROUTER_DEFAULT_MODELS;
    }
}
export async function exchangeAuthCodeForApiKey(params) {
    const response = await fetch(OPENROUTER_OAUTH_EXCHANGE_URL, {
        method: 'POST',
        headers: buildOpenRouterHeaders(),
        body: JSON.stringify({
            code: params.code,
            code_verifier: params.codeVerifier,
            code_challenge_method: OPENROUTER_CODE_CHALLENGE_METHOD,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API key exchange failed (${response.status}): ${errorText}`);
    }
    const data = (await response.json());
    if (!data.key) {
        throw new Error('OpenRouter API key exchange succeeded but no key was returned.');
    }
    return {
        apiKey: data.key,
        userId: data.user_id,
    };
}
export async function runOpenRouterOAuthLogin(callbackUrl = OPENROUTER_OAUTH_CALLBACK_URL, deps = {}) {
    const session = deps.session || createOpenRouterOAuthSession(callbackUrl);
    const { callbackUrl: effectiveCallbackUrl, codeVerifier, state, authorizationUrl: authUrl, } = session;
    const openBrowser = deps.openBrowser || open;
    const startListener = deps.startListener || startOAuthCallbackListener;
    const exchangeApiKey = deps.exchangeApiKey || exchangeAuthCodeForApiKey;
    const now = deps.now || Date.now;
    const signalTarget = deps.signalTarget || process;
    const abortSignal = deps.abortSignal;
    const listener = startListener(effectiveCallbackUrl, OPENROUTER_OAUTH_TIMEOUT_MS, state);
    let cleanupSignalHandlers = () => { };
    let cleanupAbortListener = () => { };
    try {
        await listener.ready;
        await openBrowser(authUrl);
        const waitForCancel = new Promise((_, reject) => {
            const handleSignal = (signal) => {
                reject(new Error(`OpenRouter OAuth cancelled by user (${signal}) while waiting for browser authorization.`));
            };
            signalTarget.once('SIGINT', handleSignal);
            signalTarget.once('SIGTERM', handleSignal);
            cleanupSignalHandlers = () => {
                signalTarget.removeListener('SIGINT', handleSignal);
                signalTarget.removeListener('SIGTERM', handleSignal);
            };
        });
        const waitForAbort = new Promise((_, reject) => {
            if (!abortSignal) {
                return;
            }
            const handleAbort = () => {
                reject(new DOMException('OpenRouter OAuth cancelled.', 'AbortError'));
            };
            if (abortSignal.aborted) {
                handleAbort();
                return;
            }
            abortSignal.addEventListener('abort', handleAbort, { once: true });
            cleanupAbortListener = () => {
                abortSignal.removeEventListener('abort', handleAbort);
            };
        });
        const waitStartMs = now();
        const code = await Promise.race([
            listener.waitForCode,
            waitForCancel,
            waitForAbort,
        ]);
        cleanupSignalHandlers();
        cleanupAbortListener();
        const authorizationCodeWaitMs = now() - waitStartMs;
        const exchangeStartMs = now();
        const exchangeResult = await exchangeApiKey({ code, codeVerifier });
        const apiKeyExchangeMs = now() - exchangeStartMs;
        return {
            ...exchangeResult,
            authorizationUrl: authUrl,
            authorizationCodeWaitMs,
            apiKeyExchangeMs,
        };
    }
    finally {
        cleanupSignalHandlers();
        cleanupAbortListener();
        void listener.close().catch(() => undefined);
    }
}
//# sourceMappingURL=openrouterOAuth.js.map