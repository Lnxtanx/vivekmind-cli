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
import { findCliEntryPath } from '../../commands/channel/config-utils.js';

// ── /channel start ──────────────────────────────────────────────────────────

async function startAction(context: CommandContext, args: string) {
  const channelName = args.trim();
  const cliEntryPath = findCliEntryPath();
  const execArgs = [cliEntryPath, 'channel', 'start'];
  if (channelName) {
    execArgs.push(channelName);
  }

  context.ui.setPendingItem({
    type: MessageType.INFO,
    text: t('Starting channel service...'),
  });

  try {
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, execArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.unref();

    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      let stderrOutput = '';
      let stdoutOutput = '';

      const handleSuccess = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      const handleFailure = (msg: string) => {
        if (resolved) return;
        resolved = true;
        child.kill();
        reject(new Error(msg));
      };

      let stdoutRemainder = '';
      child.stdout?.on('data', (data: Buffer) => {
        const str = stdoutRemainder + data.toString();
        const lines = str.split('\n');
        stdoutRemainder = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            context.ui.addItem(
              { type: MessageType.INFO, text: trimmed },
              Date.now(),
            );
            stdoutOutput += trimmed + '\n';
            if (
              !resolved &&
              (trimmed.includes('running') ||
                trimmed.includes('Running') ||
                trimmed.includes('Press Ctrl+C to stop'))
            ) {
              handleSuccess();
            }
          }
        }
      });

      let stderrRemainder = '';
      child.stderr?.on('data', (data: Buffer) => {
        const str = stderrRemainder + data.toString();
        const lines = str.split('\n');
        stderrRemainder = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            context.ui.addItem(
              { type: MessageType.INFO, text: trimmed },
              Date.now(),
            );
            stderrOutput += trimmed + '\n';
            if (!resolved && trimmed.includes('Error:')) {
              handleFailure(trimmed);
            }
          }
        }
      });

      child.on('error', (err) => {
        handleFailure(err.message);
      });

      child.on('exit', (code, signal) => {
        if (!resolved) {
          handleFailure(
            stderrOutput.trim() || stdoutOutput.trim() || `Exit code ${code}`,
          );
        } else {
          const statusText =
            code !== null
              ? t('exited with code {{code}}', { code: String(code) })
              : t('terminated by signal {{signal}}', { signal: signal || 'unknown' });
          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: t('Channel service stopped: {{status}}', {
                status: statusText,
              }),
            },
            Date.now(),
          );
        }
      });

      // 15 seconds timeout
      setTimeout(() => {
        if (resolved) return;
        if (child.exitCode === null) {
          handleSuccess();
        } else {
          handleFailure(
            stderrOutput.trim() || `Process exited with code ${child.exitCode}`,
          );
        }
      }, 15000);
    });

    context.ui.setPendingItem(null);
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: channelName
          ? t('Channel service started for: {{name}}', { name: channelName })
          : t('Channel service started.'),
      },
      Date.now(),
    );
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
  const cliEntryPath = findCliEntryPath();
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  context.ui.setPendingItem({
    type: MessageType.INFO,
    text: t('Stopping channel service...'),
  });

  try {
    const { stderr, stdout } = await execFileAsync(
      process.execPath,
      [cliEntryPath, 'channel', 'stop'],
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
  const cliEntryPath = findCliEntryPath();
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cliEntryPath, 'channel', 'status'],
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
  const cliEntryPath = findCliEntryPath();
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  context.ui.setPendingItem({
    type: MessageType.INFO,
    text: t('Launching Telegram setup wizard...'),
  });

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [cliEntryPath, 'channel', 'configure-telegram'],
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
