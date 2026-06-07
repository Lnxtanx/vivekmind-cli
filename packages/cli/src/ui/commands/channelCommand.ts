/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageType } from '../types.js';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { t } from '../../i18n/index.js';

// ── /channel start ──────────────────────────────────────────────────────────

async function startAction(context: CommandContext, args: string) {
  const channelName = args.trim();
  const cmd = channelName ? `channel start ${channelName}` : 'channel start';
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  context.ui.setPendingItem({
    type: MessageType.INFO,
    text: t('Starting channel service...'),
  });

  try {
    const { stderr, stdout } = await execFileAsync('vivekmind', [cmd], {
      timeout: 15000,
      windowsHide: true,
    });

    context.ui.setPendingItem(null);

    const output = (stdout || stderr || '').trim();
    if (output) {
      for (const line of output.split('\n')) {
        if (line.trim()) {
          context.ui.addItem(
            { type: MessageType.INFO, text: line.trim() },
            Date.now(),
          );
        }
      }
    } else {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: t('Channel service started.'),
        },
        Date.now(),
      );
    }
  } catch (error: unknown) {
    context.ui.setPendingItem(null);
    const msg =
      error instanceof Error ? error.message : String(error);
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: t('Failed to start channel: {{error}}', { error: msg }),
      },
      Date.now(),
    );
  }
}

// ── /channel stop ───────────────────────────────────────────────────────────

async function stopAction(context: CommandContext, _args: string) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  context.ui.setPendingItem({
    type: MessageType.INFO,
    text: t('Stopping channel service...'),
  });

  try {
    const { stderr, stdout } = await execFileAsync(
      'vivekmind',
      ['channel', 'stop'],
      { timeout: 10000, windowsHide: true },
    );

    context.ui.setPendingItem(null);

    const output = (stdout || stderr || '').trim();
    if (output) {
      for (const line of output.split('\n')) {
        if (line.trim()) {
          context.ui.addItem(
            { type: MessageType.INFO, text: line.trim() },
            Date.now(),
          );
        }
      }
    } else {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: t('Channel service stopped.'),
        },
        Date.now(),
      );
    }
  } catch (error: unknown) {
    context.ui.setPendingItem(null);
    const msg =
      error instanceof Error ? error.message : String(error);
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: msg.includes('No channel service')
          ? t('No channel service is currently running.')
          : t('Failed to stop channel: {{error}}', { error: msg }),
      },
      Date.now(),
    );
  }
}

// ── /channel status ──────────────────────────────────────────────────────────

async function statusAction(context: CommandContext, _args: string) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  try {
    const { stdout, stderr } = await execFileAsync(
      'vivekmind',
      ['channel', 'status'],
      { timeout: 5000, windowsHide: true },
    );

    const output = (stdout || stderr || '').trim();
    if (output) {
      for (const line of output.split('\n')) {
        if (line.trim()) {
          context.ui.addItem(
            { type: MessageType.INFO, text: line.trim() },
            Date.now(),
          );
        }
      }
    } else {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: t('No channel service is running.'),
        },
        Date.now(),
      );
    }
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : String(error);
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: msg.includes('No channel service')
          ? t('No channel service is currently running.')
          : t('Error checking status: {{error}}', { error: msg }),
      },
      Date.now(),
    );
  }
}

// ── /channel list ───────────────────────────────────────────────────────────

async function listAction(context: CommandContext, _args: string) {
  const { loadSettings } = await import('../../config/settings.js');
  const settings = loadSettings(process.cwd());
  const merged = settings.merged as Record<string, Record<string, unknown>>;
  const channels = merged['channels'] as Record<string, Record<string, unknown>> | undefined;

  if (!channels || Object.keys(channels).length === 0) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: t(
          'No channels configured. Use /channel configure-telegram to set one up.',
        ),
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    { type: MessageType.INFO, text: t('Configured channels:') },
    Date.now(),
  );

  for (const [name, config] of Object.entries(channels)) {
    const typeVal =
      (config as Record<string, Record<string, unknown>>)['type'] || t('unknown');
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `  ${name} (${String(typeVal)})`,
      },
      Date.now(),
    );
  }
}

// ── /channel configure-telegram ─────────────────────────────────────────────

async function configureTelegramAction(
  context: CommandContext,
  _args: string,
) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  context.ui.setPendingItem({
    type: MessageType.INFO,
    text: t('Launching Telegram setup wizard...'),
  });

  try {
    const { stdout } = await execFileAsync(
      'vivekmind',
      ['channel', 'configure-telegram'],
      { timeout: 30000, windowsHide: true },
    );

    context.ui.setPendingItem(null);

    const output = (stdout || '').trim();
    if (output) {
      for (const line of output.split('\n')) {
        if (line.trim()) {
          context.ui.addItem(
            { type: MessageType.INFO, text: line.trim() },
            Date.now(),
          );
        }
      }
    }
  } catch (error: unknown) {
    context.ui.setPendingItem(null);
    const msg =
      error instanceof Error ? error.message : String(error);
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: t('Telegram setup failed: {{error}}', { error: msg }),
      },
      Date.now(),
    );
  }
}

// ── Sub-command definitions ─────────────────────────────────────────────────

const startSubCommand: SlashCommand = {
  name: 'start',
  get description() {
    return t('Start channel service (optionally specify a channel name)');
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ['interactive'] as const,
  argumentHint: '[name]',
  action: startAction,
};

const stopSubCommand: SlashCommand = {
  name: 'stop',
  get description() {
    return t('Stop the running channel service');
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ['interactive'] as const,
  action: stopAction,
};

const statusSubCommand: SlashCommand = {
  name: 'status',
  get description() {
    return t('Show channel service status');
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ['interactive'] as const,
  action: statusAction,
};

const listSubCommand: SlashCommand = {
  name: 'list',
  get description() {
    return t('List configured channels');
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ['interactive'] as const,
  action: listAction,
};

const configureTelegramSubCommand: SlashCommand = {
  name: 'configure-telegram',
  get description() {
    return t('Set up a Telegram bot channel');
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ['interactive'] as const,
  action: configureTelegramAction,
};

// ── Parent /channel command ─────────────────────────────────────────────────

export const channelCommand: SlashCommand = {
  name: 'channel',
  get description() {
    return t('Manage messaging channels (Telegram, etc.)');
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ['interactive'] as const,
  subCommands: [
    startSubCommand,
    stopSubCommand,
    statusSubCommand,
    listSubCommand,
    configureTelegramSubCommand,
  ],
  action: async (context: CommandContext, _args: string) => {
    // Default: show status if no subcommand given
    return statusSubCommand.action!(context, '');
  },
};
