import * as path from 'node:path';
import * as os from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { CommandModule } from 'yargs';
import { loadSettings } from '../../config/settings.js';
import {
  writeStdoutLine,
  writeStderrLine,
} from '../../utils/stdioHelpers.js';

export const linkCommand: CommandModule = {
  command: 'link <channel>',
  describe:
    'Link current terminal session to a messaging channel for session handoff',
  builder: (yargs) =>
    yargs
      .positional('channel', {
        type: 'string',
        describe: 'Channel name to link to (e.g. "telegram")',
      })
      .option('chat-id', {
        type: 'string',
        describe:
          'Target chat ID on the channel (required for multi-user channels)',
      })
      .option('topic', {
        type: 'string',
        describe:
          'Brief description of the current conversation topic (prepended as context note)',
      }),
  handler: async (argv) => {
    const channelName = (argv as Record<string, unknown>)['channel'] as string;
    const chatId = (argv as Record<string, unknown>)['chat-id'] as
      | string
      | undefined;
    const topic = (argv as Record<string, unknown>)['topic'] as
      | string
      | undefined;

    // Validate the channel exists in settings
    const settings = loadSettings(process.cwd());
    const channels = (
      settings.merged as unknown as {
        channels?: Record<string, Record<string, unknown>>;
      }
    ).channels;

    if (!channels || !channels[channelName]) {
      writeStderrLine(
        `Error: Channel "${channelName}" not found in settings.\n\n` +
          `Available channels: ${Object.keys(channels ?? {}).join(', ') || '(none)'}\n` +
          `Use "vivekmind channel configure-telegram" to set one up.`,
      );
      process.exit(1);
    }

    // chatId is required to know which chat to handoff to
    if (!chatId) {
      writeStderrLine(
        'Error: --chat-id is required.\n\n' +
          'Specify the target chat ID on the channel. For Telegram, this is the numeric chat ID.\n' +
          'Example: vivekmind channel link telegram --chat-id 123456789',
      );
      process.exit(1);
    }

    // Write handoff marker file
    const handoffDir = path.join(os.homedir(), '.vivekmind', 'channels');
    try {
      mkdirSync(handoffDir, { recursive: true });
    } catch {
      // best-effort
    }

    const handoffData: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      channelId: channelName,
    };
    if (topic) {
      handoffData['topic'] = topic;
    }

    const filePath = path.join(
      handoffDir,
      `handoff-${channelName}-${chatId}.json`,
    );

    try {
      writeFileSync(filePath, JSON.stringify(handoffData, null, 2), 'utf-8');
    } catch (err) {
      writeStderrLine(
        `Error: Failed to write handoff file: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }

    writeStdoutLine(
      `✓ Session handoff created.\n\n` +
        `  Channel:  ${channelName}\n` +
        `  Chat ID:  ${chatId}\n` +
        `${topic ? `  Topic:    ${topic}\n` : ''}` +
        `  Time:     ${handoffData['timestamp']}\n\n` +
        `Your next message in this channel chat will continue with context from this terminal session.\n` +
        `The channel will inject a handoff note so the agent knows the conversation started here.\n\n` +
        `To remove the handoff: vivekmind channel unlink ${channelName} --chat-id ${chatId}`,
    );
  },
};
