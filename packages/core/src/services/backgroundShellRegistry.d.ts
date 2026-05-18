/**
 * @license
 * Copyright 2026 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
export type BackgroundShellStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export interface BackgroundShellEntry {
    /** Stable id used by the model, the `/tasks` slash command, and the Background tasks dialog. */
    shellId: string;
    /** The user-supplied command, after any pre-processing the tool applies. */
    command: string;
    /** Working directory the process was spawned in. */
    cwd: string;
    /** OS pid once spawned; absent if registration happens before spawn. */
    pid?: number;
    status: BackgroundShellStatus;
    /** Exit code on `completed`. */
    exitCode?: number;
    /** Error message on `failed`. */
    error?: string;
    /** ms epoch when the entry was registered. */
    startTime: number;
    /** ms epoch when the entry transitioned out of running. */
    endTime?: number;
    /** Absolute path of the captured stdout/stderr file. */
    outputPath: string;
    /** Aborted by `cancel()`; callers should wire it into the spawn. */
    abortController: AbortController;
}
/** Fires when a new entry is registered. */
export type BackgroundShellRegisterCallback = (entry: BackgroundShellEntry) => void;
/**
 * Fires on every status transition (running → terminal). Symmetric with
 * `BackgroundTaskRegistry.setStatusChangeCallback` so the same UI hook can
 * subscribe to both registries.
 */
export type BackgroundShellStatusChangeCallback = (entry?: BackgroundShellEntry) => void;
export declare class BackgroundShellRegistry {
    private readonly entries;
    private registerCallback;
    private statusChangeCallback;
    /**
     * Subscribe to new-entry events. Called synchronously inside `register()`.
     * Setting `undefined` clears the existing subscriber. Single-subscriber on
     * purpose — the UI hook is the only consumer in the codebase, and a list
     * would invite drift in error-handling.
     */
    setRegisterCallback(cb: BackgroundShellRegisterCallback | undefined): void;
    /**
     * Subscribe to status transitions (running → terminal). Called
     * synchronously inside `complete()` / `fail()` / `cancel()` after the
     * entry has been mutated. Same single-subscriber rationale as
     * `setRegisterCallback`.
     */
    setStatusChangeCallback(cb: BackgroundShellStatusChangeCallback | undefined): void;
    register(entry: BackgroundShellEntry): void;
    get(shellId: string): BackgroundShellEntry | undefined;
    getAll(): readonly BackgroundShellEntry[];
    hasRunningEntries(): boolean;
    complete(shellId: string, exitCode: number, endTime: number): void;
    fail(shellId: string, error: string, endTime: number): void;
    cancel(shellId: string, endTime: number): void;
    private fireRegister;
    private fireStatusChange;
    /**
     * Request cancellation without marking the entry terminal.
     *
     * Triggers the entry's AbortController so the spawn handler can tear the
     * process down, but leaves `status='running'` until the settle path
     * observes the abort and records the real exit moment + outcome via
     * `complete()` / `fail()` / `cancel()`. This keeps the registry honest:
     * a cancelled shell only shows its terminal `endTime` once the process
     * has actually drained, and a cancel-vs-exit race can't permanently hide
     * a real completed/failed result.
     *
     * Used by the `task_stop` tool path; the immediate-mark `cancel()` above
     * is reserved for `abortAll()` / shutdown, where the CLI process is
     * tearing down anyway and there is no settle handler to wait for.
     *
     * Idempotent: no-op on entries that aren't `running`.
     */
    requestCancel(shellId: string): void;
    /**
     * Drops every in-memory entry without touching spawned processes.
     *
     * Callers must only use this after verifying that no running managed shell
     * from the current session still exists.
     */
    reset(): void;
    /**
     * Cancel every still-running entry. Called on session/Config shutdown so
     * background shells don't outlive the CLI process and leak orphaned
     * children. Symmetric with `BackgroundTaskRegistry.abortAll()` for the
     * subagent path.
     */
    abortAll(): void;
}
