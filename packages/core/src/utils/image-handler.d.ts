/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
export interface ImageEncodeResult {
    base64: string;
    mimeType: string;
    sizeBytes: number;
}
/**
 * Detect an image MIME type from magic bytes. Returns application/octet-stream
 * when the buffer is empty or the signature is unknown.
 */
export declare function detectImageMimeType(buffer: Buffer): string;
/**
 * Read a file, detect its MIME type from content, and return base64 payload
 * metadata suitable for a Gemini inlineData Part.
 */
export declare function encodeImageToBase64(filePath: string): Promise<ImageEncodeResult>;
/**
 * Check whether a path uses a supported image file extension.
 */
export declare function isImageFile(filePath: string): boolean;
/**
 * Optionally resize an image using sharp if it is available at runtime.
 *
 * Returns null when the input is already within maxBytes or when sharp is not
 * installed. When resizing succeeds, the resized image is written to a temp
 * file and that path is returned.
 */
export declare function preprocessImage(filePath: string, maxBytes: number): Promise<string | null>;
