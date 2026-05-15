/**
 * CDN download with AES-128-ECB decryption.
 * Ported from cc-weixin/plugins/weixin/src/media.ts (download path only).
 */
/** Download encrypted media from CDN and decrypt it. */
export declare function downloadAndDecrypt(encryptQueryParam: string, aesKey: string): Promise<Buffer>;
