import type { ChannelPlugin } from '@vivekmind/channel-base';
export { MockPluginChannel } from './MockPluginChannel.js';
export type { MockPluginConfig } from './MockPluginChannel.js';
export { createMockServer } from './mock-server.js';
export type { MockServerHandle, MockServerOptions } from './mock-server.js';
export type { InboundMessage, OutboundMessage, WsMessage } from './protocol.js';
export declare const plugin: ChannelPlugin;
