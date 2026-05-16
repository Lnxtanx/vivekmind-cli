/**
 * @license
 * Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { BedrockContentConverter } from './converter.js';
describe('BedrockContentConverter', () => {
    it('converts user inlineData image parts into Bedrock Converse image blocks', () => {
        const converter = new BedrockContentConverter('claude-sonnet-4');
        const imageBytes = Buffer.from('image-bytes');
        const request = {
            model: 'claude-sonnet-4',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: 'Analyze this screenshot.' },
                        {
                            inlineData: {
                                mimeType: 'image/png',
                                data: imageBytes.toString('base64'),
                            },
                        },
                    ],
                },
            ],
        };
        const result = converter.convertGeminiRequestToConverse(request);
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe('user');
        expect(result.messages[0].content?.[0]).toEqual({
            text: 'Analyze this screenshot.',
        });
        expect(result.messages[0].content?.[1]).toEqual({
            image: {
                format: 'png',
                source: {
                    bytes: imageBytes,
                },
            },
        });
    });
});
//# sourceMappingURL=converter.test.js.map