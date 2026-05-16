import type { CommandModule, Argv } from 'yargs';
import { startCommand } from './channel/start.js';
import { stopCommand } from './channel/stop.js';
import { statusCommand } from './channel/status.js';
import {
  pairingListCommand,
  pairingApproveCommand,
} from './channel/pairing.js';
import { configureWeixinCommand } from './channel/configure.js';
import { configureTelegramCommand } from './channel/configure-telegram.js';
import { linkCommand } from './channel/link.js';
import { unlinkCommand } from './channel/unlink.js';

const pairingCommand: CommandModule = {
  command: 'pairing',
  describe: 'Manage DM pairing requests',
  builder: (yargs: Argv) =>
    yargs
      .command(pairingListCommand)
      .command(pairingApproveCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {},
};

const handoffCommand: CommandModule = {
  command: 'handoff',
  describe: 'Manage session handoff between terminal and messaging channels',
  builder: (yargs: Argv) =>
    yargs
      .command(linkCommand)
      .command(unlinkCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {},
};

export const channelCommand: CommandModule = {
  command: 'channel',
  describe: 'Manage messaging channels (Telegram, WeChat, DingTalk, etc.)',
  builder: (yargs: Argv) =>
    yargs
      .command(startCommand)
      .command(stopCommand)
      .command(statusCommand)
      .command(pairingCommand)
      .command(handoffCommand)
      .command(configureWeixinCommand)
      .command(configureTelegramCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {},
};
