/**
 * @license
 * Copyright 2025 VivekMind Team
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Control Context implementation
 */
export class ControlContext {
    config;
    streamJson;
    sessionId;
    abortSignal;
    debugMode;
    permissionMode;
    sdkMcpServers;
    mcpClients;
    inputClosed;
    onInterrupt;
    constructor(options) {
        this.config = options.config;
        this.streamJson = options.streamJson;
        this.sessionId = options.sessionId;
        this.abortSignal = options.abortSignal;
        this.debugMode = options.config.getDebugMode();
        this.permissionMode = options.permissionMode || 'default';
        this.sdkMcpServers = new Set();
        this.mcpClients = new Map();
        this.inputClosed = false;
        this.onInterrupt = options.onInterrupt;
    }
}
//# sourceMappingURL=ControlContext.js.map