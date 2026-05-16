import * as path from 'node:path';
import * as os from 'node:os';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import type { CommandModule } from 'yargs';
import {
  writeStdoutLine,
  writeStderrLine,
} from '../../utils/stdioHelpers.js';

export const unlinkCommand: CommandModule = {
  command: 'unlink <channel>',
  describe: 'Remove a session handoff link for a messaging channel',
  builder: (yargs) =>
    yargs
      .positional('channel', {
        type: 'string',
        describe: 'Channel name to unlink from',
      })
      .option('chat-id', {
        type: 'string',
        describe: 'Chat ID to unlink (if omitted, removes all handoffs for the channel)',
      }),
  handler: async (argv) => {
    const channelName = (argv as Record<string, unknown>)['channel'] as string;
    const chatId = (argv as Record<string, unknown>)['chat-id'] as
      | string
      | undefined;

    const handoffDir = path.join(os.homedir(), '.vivekmind', 'channels');

    if (!existsSync(handoffDir)) {
      writeStdoutLine('No handoff links found.');
      process.exit(0);
    }

    const files = readdirSync(handoffDir) as string[];
    const prefix = `handoff-${channelName}-`;

    const matchingFiles = files.filter(
      (f) => f.startsWith(prefix) && f.endsWith('.json'),
    );

    if (matchingFiles.length === 0) {
      writeStdoutLine(
        `No handoff links found for channel "${channelName}".`,
      );
      process.exit(0);
    }

    let removedCount = 0;

    for (const file of matchingFiles) {
      // If chatId is specified, only remove the matching file
      if (chatId) {
        const expectedFile = `handoff-${channelName}-${chatId}.json`;
        if (file !== expectedFile) continue;
      }

      const filePath = path.join(handoffDir, file);
      try {
        unlinkSync(filePath);
        removedCount++;
      } catch {
        // best-effort
      }
    }

    if (removedCount > 0) {
      writeStdoutLine(
        `✓ Removed ${removedCount} handoff link(s) for channel "${channelName}".`,
      );
    } else {
      writeStderrLine(
        `No matching handoff links found for channel "${channelName}"${chatId ? ` with chat ID "${chatId}"` : ''}.`,
      );
    }
  },
};
