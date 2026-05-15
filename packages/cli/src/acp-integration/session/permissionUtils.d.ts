/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ToolCallConfirmationDetails } from '@vivekmind/core';
import type { PermissionOption, ToolCallContent } from '@agentclientprotocol/sdk';
export declare function buildPermissionRequestContent(confirmation: ToolCallConfirmationDetails): ToolCallContent[];
export declare function toPermissionOptions(confirmation: ToolCallConfirmationDetails, forceHideAlwaysAllow?: boolean): PermissionOption[];
