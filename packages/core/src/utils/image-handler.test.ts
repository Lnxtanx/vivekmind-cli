/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectImageMimeType,
  encodeImageToBase64,
  isImageFile,
  preprocessImage,
} from './image-handler.js';

describe('image-handler', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-handler-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('detectImageMimeType', () => {
    it.each([
      [
        'png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'image/png',
      ],
      ['jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'image/jpeg'],
      ['gif', Buffer.from('GIF89a', 'ascii'), 'image/gif'],
      [
        'webp',
        Buffer.from([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
          0x50,
        ]),
        'image/webp',
      ],
      ['bmp', Buffer.from([0x42, 0x4d, 0x46, 0x00]), 'image/bmp'],
    ])('detects %s magic bytes', (_name, buffer, expected) => {
      expect(detectImageMimeType(buffer)).toBe(expected);
    });

    it('returns application/octet-stream for unknown data', () => {
      expect(detectImageMimeType(Buffer.from('not an image'))).toBe(
        'application/octet-stream',
      );
    });
  });

  describe('encodeImageToBase64', () => {
    it('reads a file, detects MIME type, and returns base64 metadata', async () => {
      const filePath = path.join(tempDir, 'image.dat');
      const bytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
      ]);
      await fs.writeFile(filePath, bytes);

      const result = await encodeImageToBase64(filePath);

      expect(result).toEqual({
        base64: bytes.toString('base64'),
        mimeType: 'image/png',
        sizeBytes: bytes.length,
      });
    });
  });

  describe('isImageFile', () => {
    it.each([
      ['screen.png', true],
      ['photo.JPG', true],
      ['photo.jpeg', true],
      ['animation.gif', true],
      ['image.webp', true],
      ['bitmap.bmp', true],
      ['vector.svg', false],
      ['notes.txt', false],
    ])('returns %s for %s', (filePath, expected) => {
      expect(isImageFile(filePath)).toBe(expected);
    });
  });

  describe('preprocessImage', () => {
    it('returns null when the file is already within the max byte limit', async () => {
      const filePath = path.join(tempDir, 'small.png');
      await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      await expect(preprocessImage(filePath, 100)).resolves.toBeNull();
    });
  });
});
