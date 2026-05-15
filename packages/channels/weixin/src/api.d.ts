/**
 * HTTP API wrapper for WeChat iLink Bot API.
 */
import type { GetUpdatesResp, SendMessageReq, GetConfigResp, SendTypingReq, SendTypingResp } from './types.js';
export declare function buildHeaders(token?: string): Record<string, string>;
export declare function getUpdates(baseUrl: string, token: string, getUpdatesBuf: string, timeoutMs?: number, signal?: AbortSignal): Promise<GetUpdatesResp>;
export declare function sendMessage(baseUrl: string, token: string, msg: SendMessageReq['msg']): Promise<void>;
export declare function getConfig(baseUrl: string, token: string, userId: string, contextToken?: string): Promise<GetConfigResp>;
export declare function sendTyping(baseUrl: string, token: string, req: Omit<SendTypingReq, 'base_info'>): Promise<SendTypingResp>;
