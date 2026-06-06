import type { ApprovalPolicy, ChannelConfig } from '@vivekmind/channel-base';
import * as path from 'node:path';
import { getPlugin, supportedTypes } from './channel-registry.js';

const VALID_APPROVAL_POLICIES: ApprovalPolicy[] = [
  'interactive',
  'auto-approve',
  'ask-always',
];

function parseApprovalPolicy(value: unknown): ApprovalPolicy | undefined {
  if (!value) return undefined;
  if (VALID_APPROVAL_POLICIES.includes(value as ApprovalPolicy)) {
    return value as ApprovalPolicy;
  }
  throw new Error(
    `Invalid approvalPolicy "${value}". Must be one of: ${VALID_APPROVAL_POLICIES.join(', ')}`,
  );
}

export function resolveEnvVars(value: string): string {
  if (value.startsWith('$')) {
    const envName = value.substring(1);
    const envValue = process.env[envName];
    if (!envValue) {
      throw new Error(
        `Environment variable ${envName} is not set (referenced as ${value})`,
      );
    }
    return envValue;
  }
  return value;
}

export function findCliEntryPath(): string {
  const mainModule = process.argv[1];
  if (mainModule) {
    return path.resolve(mainModule);
  }
  throw new Error('Cannot determine CLI entry path');
}

export async function parseChannelConfig(
  name: string,
  rawConfig: Record<string, unknown>,
): Promise<ChannelConfig & Record<string, unknown>> {
  if (!rawConfig['type']) {
    throw new Error(`Channel "${name}" is missing required field "type".`);
  }

  const channelType = rawConfig['type'] as string;
  const plugin = await getPlugin(channelType);
  if (!plugin) {
    const types = await supportedTypes();
    throw new Error(
      `Channel type "${channelType}" is not supported. Available: ${types.join(', ')}`,
    );
  }

  // Validate plugin-required fields
  for (const field of plugin.requiredConfigFields ?? []) {
    if (!rawConfig[field]) {
      throw new Error(
        `Channel "${name}" (${channelType}) requires "${field}".`,
      );
    }
  }

  // Resolve env vars for known credential fields
  const token = rawConfig['token']
    ? resolveEnvVars(rawConfig['token'] as string)
    : '';
  const clientId = rawConfig['clientId']
    ? resolveEnvVars(rawConfig['clientId'] as string)
    : undefined;
  const clientSecret = rawConfig['clientSecret']
    ? resolveEnvVars(rawConfig['clientSecret'] as string)
    : undefined;

    // Default senderPolicy: use 'open' when no explicit policy and no allowedUsers,
    // otherwise 'allowlist'. An empty allowlist with 'allowlist' policy silently drops
    // all messages — a common pitfall for users who skip the allowedUsers prompt.
    const rawSenderPolicy = rawConfig['senderPolicy'] as
      | ChannelConfig['senderPolicy']
      | undefined;
    const rawAllowedUsers = (rawConfig['allowedUsers'] as string[]) || [];
    const senderPolicy: ChannelConfig['senderPolicy'] =
      rawSenderPolicy ||
      (rawAllowedUsers.length > 0 ? 'allowlist' : 'open');
    return {
    ...rawConfig,
    type: channelType,
    token,
    clientId,
    clientSecret,
    senderPolicy,
    allowedUsers: rawAllowedUsers,
    sessionScope:
      (rawConfig['sessionScope'] as ChannelConfig['sessionScope']) || 'user',
    cwd: (rawConfig['cwd'] as string) || process.cwd(),
    approvalMode: rawConfig['approvalMode'] as string | undefined,
    approvalPolicy: parseApprovalPolicy(rawConfig['approvalPolicy']),
    autoApproveTools: (rawConfig['autoApproveTools'] as string[]) || [],
    instructions: rawConfig['instructions'] as string | undefined,
    model: rawConfig['model'] as string | undefined,
    groupPolicy:
      (rawConfig['groupPolicy'] as ChannelConfig['groupPolicy']) || 'disabled',
    groups: (rawConfig['groups'] as ChannelConfig['groups']) || {},
    approvalPolicy:
      (rawConfig['approvalPolicy'] as ChannelConfig['approvalPolicy']) ||
      'ask',
    autoApproveTools: (rawConfig['autoApproveTools'] as string[]) || [],
    alwaysAskTools: (rawConfig['alwaysAskTools'] as string[]) || [],
    approvalTimeoutSec: (rawConfig['approvalTimeoutSec'] as number) || 60,
  };
}
