export interface StartupPhase {
    name: string;
    startMs: number;
    durationMs: number;
}
export interface StartupReport {
    timestamp: string;
    sessionId: string;
    /** Time from Node.js process start to T0 (initStartupProfiler call), covers module loading. */
    processUptimeAtT0Ms: number;
    totalMs: number;
    phases: StartupPhase[];
    nodeVersion: string;
    platform: string;
    arch: string;
}
export declare function initStartupProfiler(): void;
export declare function profileCheckpoint(name: string): void;
export declare function getStartupReport(): StartupReport | null;
export declare function finalizeStartupProfile(sessionId?: string): void;
export declare function resetStartupProfiler(): void;
