import type { ChannelConfig } from '@vivekmind/channel-base';
export declare function resolveEnvVars(value: string): string;
export declare function findCliEntryPath(): string;
export declare function parseChannelConfig(name: string, rawConfig: Record<string, unknown>): Promise<ChannelConfig & Record<string, unknown>>;
