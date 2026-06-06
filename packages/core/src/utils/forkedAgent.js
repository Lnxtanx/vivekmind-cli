/**
 * @license
 * Copyright 2026 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { ApprovalMode } from '../config/config.js';
import { GeminiChat, StreamEventType } from '../core/geminiChat.js';
import { AgentHeadless, AgentEventEmitter, AgentEventType, AgentTerminateMode, ContextState, } from '../agents/index.js';
// Module-level slot written after each successful main turn.
let currentCacheSafeParams = null;
let currentVersion = 0;
/**
 * Save cache-safe params after a successful main conversation turn.
 * Called from GeminiClient.sendMessageStream() on successful completion.
 */
export function saveCacheSafeParams(generationConfig, history, model) {
    const prevConfig = currentCacheSafeParams?.generationConfig;
    const sysChanged = !prevConfig ||
        JSON.stringify(prevConfig.systemInstruction) !==
            JSON.stringify(generationConfig.systemInstruction);
    const toolsChanged = !prevConfig ||
        JSON.stringify(prevConfig.tools) !== JSON.stringify(generationConfig.tools);
    if (sysChanged || toolsChanged) {
        currentVersion++;
    }
    currentCacheSafeParams = {
        generationConfig: structuredClone(generationConfig),
        history,
        model,
        version: currentVersion,
    };
}
/**
 * Get the current cache-safe params, or null if not yet captured.
 */
export function getCacheSafeParams() {
    return currentCacheSafeParams
        ? structuredClone(currentCacheSafeParams)
        : null;
}
/**
 * Clear cache-safe params (e.g., on session reset).
 */
export function clearCacheSafeParams() {
    currentCacheSafeParams = null;
}
// ---------------------------------------------------------------------------
// Forked chat — shared by runForkedAgent (cache path) and speculation
// ---------------------------------------------------------------------------
/** Per-request config that strips tools so the model never produces function calls. */
const NO_TOOLS = Object.freeze({ tools: [] });
/**
 * Create an isolated GeminiChat that shares the main conversation's
 * generationConfig (including systemInstruction, tools, and history).
 *
 * Used by runForkedAgent (cache path) and directly by speculation.ts which
 * needs its own multi-turn tool-execution loop with OverlayFs interception.
 */
export function createForkedChat(config, params) {
    const maxHistoryEntries = 40;
    const history = params.history.length > maxHistoryEntries
        ? params.history.slice(-maxHistoryEntries)
        : params.history;
    return new GeminiChat(config, {
        ...params.generationConfig,
        // Disable thinking for forked queries — no reasoning tokens needed,
        // and it doesn't affect the cache prefix.
        thinkingConfig: { includeThoughts: false },
    }, [...history], undefined, // no chatRecordingService
    undefined);
}
function extractQueryUsage(metadata) {
    return {
        inputTokens: metadata?.promptTokenCount ?? 0,
        outputTokens: metadata?.candidatesTokenCount ?? 0,
        cacheHitTokens: metadata?.cachedContentTokenCount ?? 0,
    };
}
/**
 * Returns a shallow clone of config with ApprovalMode forced to YOLO.
 * Background agents must never block on permission prompts — there is
 * no user present to answer them.
 */
function createYoloConfig(config) {
    const yoloConfig = Object.create(config);
    yoloConfig.getApprovalMode = () => ApprovalMode.YOLO;
    return yoloConfig;
}
/**
 * Extracts file paths from a tool call's args object.
 * Matches any arg key that contains "path", "file", or "target".
 */
function extractFilePathsFromArgs(args) {
    const matches = new Set();
    const visit = (value, key) => {
        if (typeof value === 'string') {
            const normalizedKey = key?.toLowerCase() ?? '';
            if (normalizedKey.includes('path') ||
                normalizedKey.includes('file') ||
                normalizedKey.includes('target')) {
                matches.add(value);
            }
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value)
                visit(item, key);
            return;
        }
        if (value && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
                visit(v, k);
            }
        }
    };
    visit(args);
    return [...matches];
}
export async function runForkedAgent(params) {
    // ── Cache path ────────────────────────────────────────────────────────────
    if ('cacheSafeParams' in params) {
        const { config, userMessage, cacheSafeParams, jsonSchema, abortSignal } = params;
        const model = params.model ?? cacheSafeParams.model;
        const chat = createForkedChat(config, cacheSafeParams);
        const requestConfig = { ...NO_TOOLS };
        if (abortSignal)
            requestConfig.abortSignal = abortSignal;
        if (jsonSchema) {
            requestConfig.responseMimeType = 'application/json';
            requestConfig.responseJsonSchema = jsonSchema;
        }
        const stream = await chat.sendMessageStream(model, { message: [{ text: userMessage }], config: requestConfig }, 'forked_query');
        let fullText = '';
        let usage = {
            inputTokens: 0,
            outputTokens: 0,
            cacheHitTokens: 0,
        };
        for await (const event of stream) {
            if (event.type !== StreamEventType.CHUNK)
                continue;
            const response = event.value;
            const text = response.candidates?.[0]?.content?.parts
                ?.filter((p) => !p['thought'])
                .map((p) => p.text ?? '')
                .join('');
            if (text)
                fullText += text;
            if (response.usageMetadata)
                usage = extractQueryUsage(response.usageMetadata);
        }
        const trimmed = fullText.trim() || null;
        let jsonResult;
        if (jsonSchema && trimmed) {
            try {
                jsonResult = JSON.parse(trimmed);
            }
            catch {
                // non-JSON response despite schema constraint — treat as text
            }
        }
        return { text: trimmed, jsonResult, usage };
    }
    // ── AgentHeadless path ────────────────────────────────────────────────────
    const yoloConfig = createYoloConfig(params.config);
    const filesTouched = new Set();
    const emitter = new AgentEventEmitter();
    emitter.on(AgentEventType.TOOL_CALL, (event) => {
        for (const filePath of extractFilePathsFromArgs(event.args)) {
            filesTouched.add(filePath);
        }
    });
    const promptConfig = {
        systemPrompt: params.systemPrompt,
        initialMessages: params.extraHistory,
    };
    const modelConfig = {
        model: params.model ?? params.config.getFastModel() ?? params.config.getModel(),
    };
    const runConfig = {
        max_turns: params.maxTurns,
        max_time_minutes: params.maxTimeMinutes,
    };
    const toolConfig = params.tools !== undefined ? { tools: params.tools } : undefined;
    const headless = await AgentHeadless.create(params.name, yoloConfig, promptConfig, modelConfig, runConfig, toolConfig, emitter);
    const context = new ContextState();
    context.set('task_prompt', params.taskPrompt);
    await headless.execute(context, params.abortSignal);
    const terminateReason = headless.getTerminateMode();
    const finalText = headless.getFinalText() || undefined;
    const touched = [...filesTouched];
    if (terminateReason === AgentTerminateMode.CANCELLED) {
        return {
            status: 'cancelled',
            terminateReason,
            finalText,
            filesTouched: touched,
        };
    }
    if (terminateReason === AgentTerminateMode.ERROR ||
        terminateReason === AgentTerminateMode.TIMEOUT) {
        return {
            status: 'failed',
            terminateReason,
            finalText,
            filesTouched: touched,
        };
    }
    return {
        status: 'completed',
        terminateReason,
        finalText,
        filesTouched: touched,
    };
}
//# sourceMappingURL=forkedAgent.js.map