/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Config } from '@vivekmind/core';
import type { McpServer, McpServerHttp, McpServerSse, McpServerStdio } from '@agentclientprotocol/sdk';
import type { LoadedSettings } from '../config/settings.js';
import type { CliArgs } from '../config/config.js';
export declare function runAcpAgent(config: Config, settings: LoadedSettings, argv: CliArgs): Promise<void>;
export declare function toStdioServer(server: McpServer): McpServerStdio | undefined;
export declare function toSseServer(server: McpServer): (McpServerSse & {
    type: 'sse';
}) | undefined;
export declare function toHttpServer(server: McpServer): (McpServerHttp & {
    type: 'http';
}) | undefined;
