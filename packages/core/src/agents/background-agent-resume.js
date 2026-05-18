/**
 * @license
 * Copyright 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as jsonl from '../utils/jsonl-utils.js';
import { createDebugLogger } from '../utils/debugLogger.js';
import { AgentEventEmitter, AgentEventType, } from './runtime/agent-events.js';
import { AgentTerminateMode } from './runtime/agent-types.js';
import { AgentHeadless, ContextState } from './runtime/agent-headless.js';
import { getSubagentSessionDir, readAgentMeta, patchAgentMeta, attachJsonlTranscriptWriter, } from './agent-transcript.js';
import { getInitialChatHistory } from '../utils/environmentContext.js';
import { getGitBranch } from '../utils/gitUtils.js';
import { PermissionMode } from '../hooks/types.js';
import { runWithAgentContext } from '../tools/agent/agent-context.js';
import { FORK_AGENT, FORK_SUBAGENT_TYPE, runInForkContext, } from '../tools/agent/fork-subagent.js';
const debugLogger = createDebugLogger('BACKGROUND_AGENT_RESUME');
const META_FILE_SUFFIX = '.meta.json';
export const DEFAULT_BACKGROUND_AGENT_CONTINUATION_MESSAGE = 'Continue working on the current task from the last completed step.';
const LEGACY_FORK_RESUME_BLOCKED_REASON = 'Fork background task cannot be safely resumed because its bootstrap transcript is missing.';
const LEGACY_FORK_CAPABILITIES_BLOCKED_REASON = 'Fork background task cannot be safely resumed because its launch-time runtime constraints are missing.';
function approvalModeToPermissionMode(mode) {
    switch (mode) {
        case 'yolo':
            return PermissionMode.Yolo;
        case 'auto-edit':
            return PermissionMode.AutoEdit;
        case 'plan':
            return PermissionMode.Plan;
        case 'default':
        default:
            return PermissionMode.Default;
    }
}
function normalizeApprovalMode(value, fallback) {
    switch (value) {
        case 'plan':
        case 'default':
        case 'auto-edit':
        case 'yolo':
            return value;
        default:
            return fallback;
    }
}
function reconcileResumedApprovalMode(persistedMode, parentMode, isTrustedFolder) {
    if (isTrustedFolder ||
        (persistedMode !== 'auto-edit' && persistedMode !== 'yolo')) {
        return persistedMode;
    }
    if (parentMode === 'plan' || parentMode === 'default') {
        return parentMode;
    }
    return 'default';
}
function createApprovalModeOverride(base, mode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const override = Object.create(base);
    override.getApprovalMode = () => mode;
    return override;
}
function persistBackgroundCancellation(metaPath, persistedStatus) {
    patchAgentMeta(metaPath, {
        status: persistedStatus,
        lastUpdatedAt: new Date().toISOString(),
        lastError: undefined,
    });
}
function isWhitespaceOnlyAssistant(record) {
    if (record.type !== 'assistant' || !record.message?.parts?.length) {
        return false;
    }
    const hasFunctionCall = record.message.parts.some((part) => !!part.functionCall);
    if (hasFunctionCall)
        return false;
    return record.message.parts.every((part) => {
        if (!('text' in part) || typeof part.text !== 'string') {
            return false;
        }
        return part.text.trim().length === 0;
    });
}
function extractFunctionCallIds(record) {
    if (record.type !== 'assistant' || !record.message?.parts?.length) {
        return [];
    }
    return record.message.parts
        .map((part) => part.functionCall?.id)
        .filter((id) => typeof id === 'string' && id.length > 0);
}
function reconstructHistory(records, leafUuid) {
    if (records.length === 0)
        return [];
    const recordsByUuid = new Map();
    for (const record of records) {
        const existing = recordsByUuid.get(record.uuid) ?? [];
        existing.push(record);
        recordsByUuid.set(record.uuid, existing);
    }
    let currentUuid = leafUuid ?? records[records.length - 1].uuid;
    const uuidChain = [];
    const visited = new Set();
    while (currentUuid && !visited.has(currentUuid)) {
        visited.add(currentUuid);
        uuidChain.push(currentUuid);
        const recordsForUuid = recordsByUuid.get(currentUuid);
        if (!recordsForUuid?.length)
            break;
        currentUuid = recordsForUuid[0].parentUuid;
    }
    uuidChain.reverse();
    return uuidChain
        .map((uuid) => recordsByUuid.get(uuid)?.[0])
        .filter((record) => !!record);
}
function extractText(parts) {
    if (!parts?.length)
        return '';
    return parts
        .map((part) => ('text' in part && part.text ? part.text : ''))
        .join('\n')
        .trim();
}
function coalesceAdjacentUserHistory(messages) {
    const result = [];
    for (const message of messages) {
        if (message.role === 'user' &&
            result.length > 0 &&
            result[result.length - 1].role === 'user') {
            result[result.length - 1] = {
                ...result[result.length - 1],
                parts: [
                    ...(result[result.length - 1].parts ?? []),
                    ...structuredClone(message.parts ?? []),
                ],
            };
            continue;
        }
        result.push(structuredClone(message));
    }
    return result;
}
function recoverTranscript(records) {
    const chain = reconstructHistory(records);
    const filtered = chain.filter((record) => !isWhitespaceOnlyAssistant(record));
    const bootstrapRecord = filtered.find((record) => record.type === 'system' &&
        record.subtype === 'agent_bootstrap' &&
        record.systemPayload);
    const launchPromptRecord = filtered.find((record) => record.type === 'system' &&
        record.subtype === 'agent_launch_prompt' &&
        record.systemPayload);
    const initialPrompt = filtered.find((record) => record.type === 'user')
        ? extractText(filtered.find((record) => record.type === 'user')?.message?.parts)
        : undefined;
    const stableForBranch = [...filtered];
    while (stableForBranch.length > 0) {
        const last = stableForBranch[stableForBranch.length - 1];
        if (isWhitespaceOnlyAssistant(last)) {
            stableForBranch.pop();
            continue;
        }
        if (extractFunctionCallIds(last).length > 0) {
            stableForBranch.pop();
            continue;
        }
        break;
    }
    const nonSystemStableRecords = stableForBranch.filter((record) => record.type !== 'system');
    const forkLaunchSeedUuid = bootstrapRecord && nonSystemStableRecords[0]?.type === 'user'
        ? nonSystemStableRecords[0].uuid
        : null;
    return {
        history: coalesceAdjacentUserHistory(nonSystemStableRecords
            .map((record) => record.message)
            .filter((message) => message !== undefined)),
        initialPrompt: initialPrompt || undefined,
        lastStableUuid: stableForBranch.length > 0
            ? stableForBranch[stableForBranch.length - 1].uuid
            : null,
        forkBootstrap: bootstrapRecord?.systemPayload &&
            bootstrapRecord.systemPayload.kind ===
                'fork' &&
            typeof launchPromptRecord?.systemPayload?.displayText === 'string'
            ? {
                history: structuredClone(bootstrapRecord.systemPayload
                    .history),
                systemInstruction: structuredClone(bootstrapRecord.systemPayload
                    .systemInstruction),
                tools: structuredClone(bootstrapRecord.systemPayload
                    .tools),
                taskPrompt: launchPromptRecord.systemPayload.displayText,
                runtimeHistory: coalesceAdjacentUserHistory(nonSystemStableRecords
                    .filter((record) => record.uuid !== forkLaunchSeedUuid)
                    .map((record) => record.message)
                    .filter((message) => message !== undefined)),
            }
            : undefined,
    };
}
function getCompletionStats(subagent, liveToolCallCount) {
    const summary = subagent.getExecutionSummary();
    return {
        totalTokens: summary.totalTokens,
        toolUses: liveToolCallCount,
        durationMs: summary.totalDurationMs,
    };
}
function buildRecoveredNotice(count) {
    return count === 1
        ? 'Recovered 1 interrupted background agent. Open Background tasks and press r to resume.'
        : `Recovered ${count} interrupted background agents. Open Background tasks and press r to resume.`;
}
export class BackgroundAgentResumeService {
    config;
    resumeOperations = new Map();
    constructor(config) {
        this.config = config;
    }
    async loadPausedBackgroundAgents(sessionId) {
        const projectDir = this.config.storage.getProjectDir();
        const dir = getSubagentSessionDir(projectDir, sessionId);
        let files;
        try {
            files = await fs.readdir(dir);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
        const registry = this.config.getBackgroundTaskRegistry();
        const recovered = [];
        for (const fileName of files) {
            if (!fileName.endsWith(META_FILE_SUFFIX))
                continue;
            const metaPath = path.join(dir, fileName);
            try {
                const meta = readAgentMeta(metaPath);
                if (!meta || meta.status !== 'running')
                    continue;
                if (registry.get(meta.agentId))
                    continue;
                const subagentName = meta.subagentName ?? meta.agentType;
                if (!subagentName)
                    continue;
                const target = await this.resolveResumeTarget(subagentName);
                const outputFile = path.join(dir, fileName.slice(0, -META_FILE_SUFFIX.length) + '.jsonl');
                const records = await jsonl.read(outputFile);
                const recovery = recoverTranscript(records);
                const parsedStartTime = Date.parse(meta.createdAt);
                const resumeBlockedReason = target.unavailableReason ||
                    (target.isFork && !recovery.forkBootstrap
                        ? LEGACY_FORK_RESUME_BLOCKED_REASON
                        : target.isFork &&
                            (!recovery.forkBootstrap?.systemInstruction ||
                                !recovery.forkBootstrap?.tools)
                            ? LEGACY_FORK_CAPABILITIES_BLOCKED_REASON
                            : undefined);
                const entry = {
                    agentId: meta.agentId,
                    description: meta.description,
                    subagentType: target.agentName,
                    status: 'paused',
                    startTime: Number.isFinite(parsedStartTime)
                        ? parsedStartTime
                        : Date.now(),
                    abortController: new AbortController(),
                    prompt: recovery.initialPrompt,
                    outputFile,
                    metaPath,
                    error: meta.lastError === resumeBlockedReason ? undefined : meta.lastError,
                    resumeBlockedReason,
                };
                registry.register(entry);
                recovered.push(entry);
            }
            catch (error) {
                debugLogger.warn(`[BackgroundAgentResume] Failed to load paused background agent from ${metaPath}:`, error);
            }
        }
        return recovered;
    }
    async resumeBackgroundAgent(agentId, initialMessage) {
        const trimmedMessage = initialMessage?.trim();
        const existingOperation = this.resumeOperations.get(agentId);
        if (existingOperation) {
            if (trimmedMessage) {
                const registry = this.config.getBackgroundTaskRegistry();
                if (!registry.queueMessage(agentId, trimmedMessage)) {
                    existingOperation.continuationMessages.push(trimmedMessage);
                }
            }
            return existingOperation.promise;
        }
        const operation = {
            continuationMessages: trimmedMessage ? [trimmedMessage] : [],
            promise: Promise.resolve(undefined),
        };
        operation.promise = this.resumeBackgroundAgentInternal(agentId, operation).finally(() => {
            this.resumeOperations.delete(agentId);
        });
        this.resumeOperations.set(agentId, operation);
        return operation.promise;
    }
    async resumeBackgroundAgentInternal(agentId, operation) {
        const registry = this.config.getBackgroundTaskRegistry();
        const existing = registry.get(agentId);
        if (!existing || existing.status !== 'paused') {
            return existing;
        }
        const metaPath = existing.metaPath;
        const outputFile = existing.outputFile;
        if (!metaPath || !outputFile) {
            return undefined;
        }
        const meta = readAgentMeta(metaPath);
        if (!meta) {
            return undefined;
        }
        const bgAbortController = new AbortController();
        registry.register({
            ...existing,
            status: 'running',
            abortController: bgAbortController,
            endTime: undefined,
            result: undefined,
            error: undefined,
            resumeBlockedReason: undefined,
            stats: undefined,
            recentActivities: [],
            pendingMessages: [...(existing.pendingMessages ?? [])],
            notified: false,
        });
        try {
            const subagentName = meta.subagentName ?? meta.agentType;
            const target = await this.resolveResumeTarget(subagentName);
            if (!target.subagentConfig && !target.isFork) {
                const reason = target.unavailableReason ||
                    `Subagent "${subagentName}" is no longer available.`;
                patchAgentMeta(metaPath, {
                    lastError: undefined,
                    lastUpdatedAt: new Date().toISOString(),
                });
                this.restorePausedEntry(agentId, { resumeBlockedReason: reason });
                return undefined;
            }
            const parentApprovalMode = normalizeApprovalMode(this.config.getApprovalMode(), 'default');
            const resolvedApprovalMode = reconcileResumedApprovalMode(normalizeApprovalMode(meta.resolvedApprovalMode, parentApprovalMode), parentApprovalMode, this.config.isTrustedFolder());
            const agentConfig = resolvedApprovalMode !== this.config.getApprovalMode()
                ? createApprovalModeOverride(this.config, resolvedApprovalMode)
                : this.config;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bgConfig = Object.create(agentConfig);
            bgConfig.getShouldAvoidPermissionPrompts = () => true;
            const records = await jsonl.read(outputFile);
            const recovery = recoverTranscript(records);
            const resumeHistory = target.isFork
                ? [
                    ...(recovery.forkBootstrap?.history ?? []),
                    {
                        role: 'user',
                        parts: [{ text: recovery.forkBootstrap?.taskPrompt ?? '' }],
                    },
                    ...(recovery.forkBootstrap?.runtimeHistory ?? []),
                ]
                : [
                    ...(await getInitialChatHistory(bgConfig)),
                    ...recovery.history,
                ];
            const promptMessages = [...operation.continuationMessages];
            const continuationPrompt = promptMessages.join('\n\n').trim() ||
                DEFAULT_BACKGROUND_AGENT_CONTINUATION_MESSAGE;
            const writerInitialPrompt = continuationPrompt;
            if (target.isFork && (!resumeHistory || resumeHistory.length === 0)) {
                const reason = LEGACY_FORK_RESUME_BLOCKED_REASON;
                patchAgentMeta(metaPath, {
                    lastError: undefined,
                    lastUpdatedAt: new Date().toISOString(),
                });
                this.restorePausedEntry(agentId, { resumeBlockedReason: reason });
                return undefined;
            }
            if (target.isFork && !recovery.forkBootstrap) {
                const reason = LEGACY_FORK_RESUME_BLOCKED_REASON;
                patchAgentMeta(metaPath, {
                    lastError: undefined,
                    lastUpdatedAt: new Date().toISOString(),
                });
                this.restorePausedEntry(agentId, { resumeBlockedReason: reason });
                return undefined;
            }
            if (target.isFork &&
                (!recovery.forkBootstrap?.systemInstruction ||
                    !recovery.forkBootstrap?.tools)) {
                const reason = LEGACY_FORK_CAPABILITIES_BLOCKED_REASON;
                patchAgentMeta(metaPath, {
                    lastError: undefined,
                    lastUpdatedAt: new Date().toISOString(),
                });
                this.restorePausedEntry(agentId, { resumeBlockedReason: reason });
                return undefined;
            }
            const bgEventEmitter = new AgentEventEmitter();
            const subagent = target.isFork
                ? await this.createResumedForkSubagent(bgConfig, bgEventEmitter, resumeHistory ?? [], recovery.forkBootstrap)
                : await this.config
                    .getSubagentManager()
                    .createAgentHeadless(target.subagentConfig, bgConfig, {
                    eventEmitter: bgEventEmitter,
                    promptConfigOverrides: {
                        initialMessages: resumeHistory,
                    },
                });
            const projectRoot = this.config.getProjectRoot();
            const { cleanup: cleanupJsonl } = attachJsonlTranscriptWriter(bgEventEmitter, outputFile, {
                agentId: meta.agentId,
                agentName: target.agentName,
                agentColor: target.subagentConfig?.color ?? meta.agentColor,
                sessionId: meta.parentSessionId,
                cwd: projectRoot,
                version: this.config.getCliVersion() || 'unknown',
                gitBranch: getGitBranch(projectRoot),
                initialUserPrompt: writerInitialPrompt,
                appendToExisting: true,
                initialParentUuid: recovery.lastStableUuid,
            });
            const nextResumeCount = (meta.resumeCount ?? 0) + 1;
            patchAgentMeta(metaPath, {
                status: 'running',
                lastUpdatedAt: new Date().toISOString(),
                resolvedApprovalMode,
                subagentName: target.agentName,
                agentColor: target.subagentConfig?.color ?? meta.agentColor,
                resumeCount: nextResumeCount,
                lastError: undefined,
            });
            const pendingMessages = [
                ...(registry.get(meta.agentId)?.pendingMessages ?? []),
            ];
            const entry = {
                ...existing,
                subagentType: target.agentName,
                status: 'running',
                abortController: bgAbortController,
                endTime: undefined,
                result: undefined,
                error: undefined,
                resumeBlockedReason: undefined,
                stats: undefined,
                prompt: recovery.initialPrompt ?? existing.prompt,
                recentActivities: [],
                pendingMessages,
                notified: false,
            };
            registry.register(entry);
            const lateContinuationMessages = operation.continuationMessages.slice(promptMessages.length);
            for (const message of lateContinuationMessages) {
                registry.queueMessage(meta.agentId, message);
            }
            subagent.setExternalMessageProvider(() => registry.drainMessages(meta.agentId));
            const hookSystem = this.config.getHookSystem();
            const contextState = new ContextState();
            contextState.set('task_prompt', continuationPrompt);
            const resolvedMode = approvalModeToPermissionMode(resolvedApprovalMode);
            await this.applySubagentStartHook(contextState, {
                agentId: meta.agentId,
                agentType: meta.agentType,
                resolvedMode,
                signal: bgAbortController.signal,
            });
            const bgEmitter = subagent.getCore().getEventEmitter();
            let liveToolCallCount = 0;
            const refreshLiveStats = () => {
                const target = registry.get(meta.agentId);
                if (!target || target.status !== 'running')
                    return;
                target.stats = getCompletionStats(subagent, liveToolCallCount);
            };
            const onToolCall = (event) => {
                liveToolCallCount += 1;
                refreshLiveStats();
                registry.appendActivity(meta.agentId, {
                    name: event.name,
                    description: event.description,
                    at: event.timestamp,
                });
            };
            const onUsageMetadata = () => {
                refreshLiveStats();
            };
            bgEmitter.on(AgentEventType.TOOL_CALL, onToolCall);
            bgEmitter.on(AgentEventType.USAGE_METADATA, onUsageMetadata);
            const runBody = async () => {
                try {
                    await subagent.execute(contextState, bgAbortController.signal);
                    if (hookSystem && !bgAbortController.signal.aborted) {
                        await this.runSubagentStopHookLoop(subagent, {
                            agentId: meta.agentId,
                            agentType: meta.agentType,
                            transcriptPath: outputFile,
                            resolvedMode,
                            signal: bgAbortController.signal,
                        });
                    }
                    const terminateMode = subagent.getTerminateMode();
                    const finalText = subagent.getFinalText();
                    const stats = getCompletionStats(subagent, liveToolCallCount);
                    if (terminateMode === AgentTerminateMode.GOAL) {
                        registry.complete(meta.agentId, finalText, stats);
                        patchAgentMeta(metaPath, {
                            status: 'completed',
                            lastUpdatedAt: new Date().toISOString(),
                            lastError: undefined,
                        });
                    }
                    else if (terminateMode === AgentTerminateMode.CANCELLED) {
                        registry.finalizeCancelled(meta.agentId, finalText, stats);
                        persistBackgroundCancellation(metaPath, registry.get(meta.agentId)?.persistedCancellationStatus ??
                            'cancelled');
                    }
                    else {
                        const failureText = finalText || `Agent terminated with mode: ${terminateMode}`;
                        registry.fail(meta.agentId, failureText, stats);
                        patchAgentMeta(metaPath, {
                            status: 'failed',
                            lastUpdatedAt: new Date().toISOString(),
                            lastError: failureText,
                        });
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    debugLogger.error(`[BackgroundAgentResume] Background agent failed: ${errorMessage}`);
                    if (bgAbortController.signal.aborted) {
                        registry.finalizeCancelled(meta.agentId, errorMessage, getCompletionStats(subagent, liveToolCallCount));
                        persistBackgroundCancellation(metaPath, registry.get(meta.agentId)?.persistedCancellationStatus ??
                            'cancelled');
                    }
                    else {
                        registry.fail(meta.agentId, errorMessage, getCompletionStats(subagent, liveToolCallCount));
                        patchAgentMeta(metaPath, {
                            status: 'failed',
                            lastUpdatedAt: new Date().toISOString(),
                            lastError: errorMessage,
                        });
                    }
                }
                finally {
                    bgEmitter.off(AgentEventType.TOOL_CALL, onToolCall);
                    bgEmitter.off(AgentEventType.USAGE_METADATA, onUsageMetadata);
                    cleanupJsonl?.();
                }
            };
            const framedRunBody = () => runWithAgentContext({ agentId: meta.agentId }, runBody);
            void (target.isFork ? runInForkContext(framedRunBody) : framedRunBody());
            return entry;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            debugLogger.warn(`[BackgroundAgentResume] Failed to resume background agent ${agentId}: ${errorMessage}`);
            patchAgentMeta(metaPath, {
                lastError: errorMessage,
                lastUpdatedAt: new Date().toISOString(),
            });
            const latest = registry.get(agentId);
            if (latest?.status === 'running') {
                if (latest.abortController.signal.aborted) {
                    registry.finalizeCancelled(agentId, errorMessage);
                }
                else {
                    this.restorePausedEntry(agentId, { error: errorMessage });
                }
            }
            return undefined;
        }
    }
    abandonBackgroundAgent(agentId) {
        const registry = this.config.getBackgroundTaskRegistry();
        const entry = registry.get(agentId);
        if (!entry || entry.status !== 'paused' || !entry.metaPath) {
            return false;
        }
        patchAgentMeta(entry.metaPath, {
            status: 'cancelled',
            lastUpdatedAt: new Date().toISOString(),
            lastError: undefined,
        });
        registry.abandon(agentId);
        return true;
    }
    buildRecoveredBackgroundAgentsNotice(count) {
        return buildRecoveredNotice(count);
    }
    async resolveResumeTarget(subagentName) {
        if (subagentName === FORK_SUBAGENT_TYPE) {
            return {
                agentName: FORK_AGENT.name,
                isFork: true,
                subagentConfig: FORK_AGENT,
            };
        }
        const subagentConfig = await this.config
            .getSubagentManager()
            .loadSubagent(subagentName);
        if (!subagentConfig) {
            return {
                agentName: subagentName,
                isFork: false,
                unavailableReason: `Subagent "${subagentName}" is no longer available.`,
            };
        }
        return {
            agentName: subagentConfig.name,
            isFork: false,
            subagentConfig,
        };
    }
    restorePausedEntry(agentId, options = {}) {
        const registry = this.config.getBackgroundTaskRegistry();
        const latest = registry.get(agentId);
        if (!latest)
            return undefined;
        const pausedEntry = {
            ...latest,
            status: 'paused',
            abortController: new AbortController(),
            endTime: undefined,
            result: undefined,
            error: options.error,
            resumeBlockedReason: options.resumeBlockedReason,
            stats: undefined,
            recentActivities: [],
            pendingMessages: [...(latest.pendingMessages ?? [])],
            notified: false,
        };
        registry.register(pausedEntry);
        return pausedEntry;
    }
    async createResumedForkSubagent(agentConfig, eventEmitter, initialMessages, bootstrap) {
        const promptConfig = {
            renderedSystemPrompt: structuredClone(bootstrap.systemInstruction),
            initialMessages,
        };
        const toolConfig = {
            tools: structuredClone(bootstrap.tools),
        };
        return AgentHeadless.create(FORK_AGENT.name, agentConfig, promptConfig, {}, {}, toolConfig, eventEmitter);
    }
    async applySubagentStartHook(contextState, opts) {
        const hookSystem = this.config.getHookSystem();
        if (!hookSystem)
            return;
        try {
            const startHookOutput = await hookSystem.fireSubagentStartEvent(opts.agentId, opts.agentType, opts.resolvedMode, opts.signal);
            const additionalContext = startHookOutput?.getAdditionalContext();
            if (additionalContext) {
                contextState.set('hook_context', additionalContext);
            }
        }
        catch (hookError) {
            debugLogger.warn(`[BackgroundAgentResume] SubagentStart hook failed, continuing execution: ${hookError}`);
        }
    }
    async runSubagentStopHookLoop(subagent, opts) {
        const { agentId, agentType, transcriptPath, resolvedMode, signal } = opts;
        const hookSystem = this.config.getHookSystem();
        if (!hookSystem)
            return;
        let stopHookActive = false;
        const maxIterations = 5;
        for (let i = 0; i < maxIterations; i++) {
            try {
                const stopHookOutput = await hookSystem.fireSubagentStopEvent(agentId, agentType, transcriptPath, subagent.getFinalText(), stopHookActive, resolvedMode, signal);
                const typedStopOutput = stopHookOutput;
                if (!typedStopOutput?.isBlockingDecision() &&
                    !typedStopOutput?.shouldStopExecution()) {
                    return;
                }
                stopHookActive = true;
                const continueContext = new ContextState();
                continueContext.set('task_prompt', typedStopOutput.getEffectiveReason());
                await subagent.execute(continueContext, signal);
                if (signal?.aborted)
                    return;
            }
            catch (hookError) {
                debugLogger.warn(`[BackgroundAgentResume] SubagentStop hook failed, allowing stop: ${hookError}`);
                return;
            }
        }
        debugLogger.warn(`[BackgroundAgentResume] SubagentStop hook reached maximum iterations (${maxIterations}), forcing stop`);
    }
}
//# sourceMappingURL=background-agent-resume.js.map