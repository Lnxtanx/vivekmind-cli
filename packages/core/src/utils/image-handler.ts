/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ImageEncodeResult {
  base64: string;
  mimeType: string;
  sizeBytes: number;
}

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
]);

type SharpInstance = {
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(options: {
    width?: number;
    height?: number;
    withoutEnlargement: true;
  }): SharpInstance;
  png(): SharpInstance;
  jpeg(options?: { quality?: number }): SharpInstance;
  webp(options?: { quality?: number }): SharpInstance;
  toBuffer(): Promise<Buffer>;
};

type SharpFactory = (input: string | Buffer) => SharpInstance;

/**
 * Detect an image MIME type from magic bytes. Returns application/octet-stream
 * when the buffer is empty or the signature is unknown.
 */
export function detectImageMimeType(buffer: Buffer): string {
  if (buffer.length >= 8) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp';
  }

  return 'application/octet-stream';
}

/**
 * Read a file, detect its MIME type from content, and return base64 payload
 * metadata suitable for a Gemini inlineData Part.
 */
export async function encodeImageToBase64(
  filePath: string,
): Promise<ImageEncodeResult> {
  const buffer = await fs.readFile(filePath);
  return {
    base64: buffer.toString('base64'),
    mimeType: detectImageMimeType(buffer),
    sizeBytes: buffer.length,
  };
}

/**
 * Check whether a path uses a supported image file extension.
 */
export function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function loadSharp(): Promise<SharpFactory | null> {
  try {
    const moduleName = 'sharp';
    const sharpModule = (await import(moduleName)) as {
      default?: SharpFactory;
    } & SharpFactory;
    return sharpModule.default ?? sharpModule;
  } catch {
    return null;
  }
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/png':
      return '.png';
    default:
      return '.png';
  }
}

function encoderForMimeType(
  image: SharpInstance,
  mimeType: string,
): SharpInstance {
  switch (mimeType) {
    case 'image/jpeg':
      return image.jpeg({ quality: 85 });
    case 'image/webp':
      return image.webp({ quality: 85 });
    default:
      return image.png();
  }
}

/**
 * Optionally resize an image using sharp if it is available at runtime.
 *
 * Returns null when the input is already within maxBytes or when sharp is not
 * installed. When resizing succeeds, the resized image is written to a temp
 * file and that path is returned.
 */
export async function preprocessImage(
  filePath: string,
  maxBytes: number,
): Promise<string | null> {
  const stat = await fs.stat(filePath);
  if (stat.size <= maxBytes) {
    return null;
  }

  const sharp = await loadSharp();
  if (!sharp) {
    return null;
  }

  const originalBuffer = await fs.readFile(filePath);
  const mimeType = detectImageMimeType(originalBuffer);
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const maxDimension = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  const resizeDimension =
    maxDimension > 0 ? Math.max(1, Math.floor(maxDimension * 0.75)) : undefined;

  const resized = encoderForMimeType(
    resizeDimension
      ? image.resize({
          width: resizeDimension,
          height: resizeDimension,
          withoutEnlargement: true,
        })
      : image,
    mimeType,
  );
  const resizedBuffer = await resized.toBuffer();

  if (resizedBuffer.length >= stat.size) {
    return null;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vivekmind-image-'));
  const outputPath = path.join(
    tempDir,
    `${path.basename(filePath, path.extname(filePath))}-processed${extensionForMimeType(
      mimeType,
    )}`,
  );
  await fs.writeFile(outputPath, resizedBuffer);
  return outputPath;
}
