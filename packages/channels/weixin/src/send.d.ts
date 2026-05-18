/**
 * Send messages to WeChat users.
 */
/** Convert markdown to plain text (WeChat doesn't support markdown) */
export declare function markdownToPlainText(text: string): string;
/** Send a text message */
export declare function sendText(params: {
    to: string;
    text: string;
    baseUrl: string;
    token: string;
    contextToken: string;
}): Promise<void>;
