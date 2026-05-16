/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Control Context
 *
 * Layer 1 of the control plane architecture. Provides shared, session-scoped
 * state for all controllers and services, eliminating the need for prop
 * drilling. Mutable fields are intentionally exposed so controllers can track
 * runtime state (e.g. permission mode, active MCP clients).
 */
import type { Config, MCPServerConfig } from '@vivekmind/core';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StreamJsonOutputAdapter } from '../io/StreamJsonOutputAdapter.js';
import type { PermissionMode } from '../types.js';
/**
 * Control Context interface
 *
 * Provides shared access to session-scoped resources and mutable state
 * for all controllers across both ControlDispatcher (protocol routing) and
 * ControlService (programmatic API).
 */
export interface IControlContext {
    readonly config: Config;
    readonly streamJson: StreamJsonOutputAdapter;
    readonly sessionId: string;
    readonly abortSignal: AbortSignal;
    readonly debugMode: boolean;
    permissionMode: PermissionMode;
    sdkMcpServers: Set<string>;
    mcpClients: Map<string, {
        client: Client;
        config: MCPServerConfig;
    }>;
    inputClosed: boolean;
    onInterrupt?: () => void;
}
/**
 * Control Context implementation
 */
export declare class ControlContext implements IControlContext {
    readonly config: Config;
    readonly streamJson: StreamJsonOutputAdapter;
    readonly sessionId: string;
    readonly abortSignal: AbortSignal;
    readonly debugMode: boolean;
    permissionMode: PermissionMode;
    sdkMcpServers: Set<string>;
    mcpClients: Map<string, {
        client: Client;
        config: MCPServerConfig;
    }>;
    inputClosed: boolean;
    onInterrupt?: () => void;
    constructor(options: {
        config: Config;
        streamJson: StreamJsonOutputAdapter;
        sessionId: string;
        abortSignal: AbortSignal;
        permissionMode?: PermissionMode;
        onInterrupt?: () => void;
    });
}
