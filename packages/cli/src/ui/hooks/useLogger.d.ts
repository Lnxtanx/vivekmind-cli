/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Storage } from '@vivekmind/core';
import { Logger } from '@vivekmind/core';
/**
 * Hook to manage the logger instance.
 */
export declare const useLogger: (storage: Storage, sessionId: string) => Logger | null;
