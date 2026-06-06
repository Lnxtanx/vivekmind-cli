import * as readline from 'node:readline';
import type { CommandModule, Argv } from 'yargs';
import { loadSettings, SettingScope, USER_SETTINGS_PATH } from '../../config/settings.js';
import { writeStdoutLine, writeStderrLine } from '../../utils/stdioHelpers.js';

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function configureTelegramInteractive(prefillName?: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    writeStdoutLine('');
    writeStdoutLine('=== VivekMind Telegram Channel Setup ===');
    writeStdoutLine('');
    writeStdoutLine(
      'To create a Telegram bot, follow these steps:',
    );
    writeStdoutLine('  1. Open Telegram and search for @BotFather');
    writeStdoutLine('  2. Send /newbot');
    writeStdoutLine('  3. Follow the prompts to name your bot');
    writeStdoutLine('  4. BotFather will give you a bot token (looks like 123456:ABC-DEF...)');
    writeStdoutLine('');

    const envToken = process.env['TELEGRAM_BOT_TOKEN'];
    if (envToken) {
      writeStdoutLine(`  Found TELEGRAM_BOT_TOKEN in environment.`);
    }

    // Channel name
    const name = prefillName || await question(
      rl,
      'Channel name (used as identifier, e.g. "my-telegram"): ',
    );
    if (!name) {
      writeStderrLine('Error: Channel name is required.');
      process.exit(1);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      writeStderrLine(
        'Error: Channel name must only contain letters, numbers, hyphens, and underscores.',
      );
      process.exit(1);
    }

    // Bot token
    let token = envToken || '';
    if (!token) {
      token = await question(
        rl,
        'Telegram bot token (from @BotFather): ',
      );
    }
    if (!token) {
      writeStderrLine('Error: Bot token is required. Set TELEGRAM_BOT_TOKEN or provide it interactively.');
      process.exit(1);
    }

    // Validate token by calling getMe
    writeStdoutLine('');
    writeStdoutLine('Validating bot token...');
    try {
      const resp = await fetch(
        `https://api.telegram.org/bot${token}/getMe`,
      );
      if (!resp.ok) {
        const body = await resp.text();
        writeStderrLine(
          `Error: Invalid bot token. Telegram API returned: ${resp.status} ${body}`,
        );
        process.exit(1);
      }
      const data = (await resp.json()) as { ok: boolean; result?: { id: number; username: string; first_name: string } };
      if (data.ok && data.result) {
        writeStdoutLine(
          `  Bot verified: @${data.result.username} (${data.result.first_name})`,
        );
      } else {
        writeStderrLine('Error: Unexpected response from Telegram API.');
        process.exit(1);
      }
    } catch (err) {
      writeStderrLine(
        `Error: Could not reach Telegram API. ${err instanceof Error ? err.message : String(err)}`,
      );
      writeStderrLine('Make sure you have internet access and the token is correct.');
      process.exit(1);
    }

    // Model (optional)
    const model = await question(
      rl,
      'Model to use (press Enter to use default): ',
    );

    // CWD (optional)
    const cwd = await question(
      rl,
      `Working directory (press Enter for ${process.cwd()}): `,
    );

    // Allowed users (optional)
    const allowedUsersRaw = await question(
      rl,
      'Allowed Telegram user IDs (comma-separated, press Enter for open access): ',
    );
    const allowedUsers = allowedUsersRaw
      ? allowedUsersRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Approval policy
    writeStdoutLine('');
    writeStdoutLine('--- Tool Approval Settings ---');
    const approvalPolicyRaw = await question(
      rl,
      'Tool approval mode? (ask/yolo) [ask]: ',
    );
    const approvalPolicy = approvalPolicyRaw.toLowerCase() === 'yolo' ? 'yolo' : 'ask';

    let autoApproveTools: string[] = [];
    let alwaysAskTools: string[] = [];

    if (approvalPolicy === 'ask') {
      const autoApproveReadOnly = await question(
        rl,
        'Auto-approve read-only tools (read_file, glob, grep_search, list_directory, web_fetch)? (Y/n): ',
      );
      if (!autoApproveReadOnly || autoApproveReadOnly.toLowerCase() === 'y') {
        autoApproveTools = ['read_file', 'glob', 'grep_search', 'list_directory', 'web_fetch'];
      }

      const alwaysAskRaw = await question(
        rl,
        'Tools that always require approval (comma-separated, press Enter for default: shell, edit, write_file): ',
      );
      alwaysAskTools = alwaysAskRaw
        ? alwaysAskRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : ['shell', 'edit', 'write_file'];
    }

    const approvalTimeoutRaw = await question(
      rl,
      'Approval timeout in seconds (press Enter for 60): ',
    );
    const approvalTimeoutSec = approvalTimeoutRaw
      ? parseInt(approvalTimeoutRaw, 10)
      : 60;

    // Save
    const settings = loadSettings(process.cwd());
    const existingChannels = (settings.merged.channels || {}) as Record<
      string,
      Record<string, unknown>
    >;

    if (existingChannels[name]) {
      writeStderrLine(
        `Error: Channel "${name}" already exists in settings. Remove it first or choose a different name.`,
      );
      process.exit(1);
    }

    const channelConfig: Record<string, unknown> = {
      type: 'telegram',
      token: `$TELEGRAM_BOT_TOKEN`,
    };

    if (model) {
      channelConfig['model'] = model;
    }
    if (cwd) {
      channelConfig['cwd'] = cwd;
    }
    if (allowedUsers.length > 0) {
      channelConfig['allowedUsers'] = allowedUsers;
      channelConfig['senderPolicy'] = 'allowlist';
    } else {
      // Default to open access when no users specified, otherwise parseChannelConfig
      // defaults to 'allowlist' with empty users, silently dropping all messages.
      channelConfig['senderPolicy'] = 'open';
    }

    // Approval settings (only save if non-default)
    if (approvalPolicy === 'yolo') {
      channelConfig['approvalPolicy'] = 'yolo';
    } else if (autoApproveTools.length > 0 || alwaysAskTools.length > 0) {
      if (autoApproveTools.length > 0) {
        channelConfig['autoApproveTools'] = autoApproveTools;
      }
      if (alwaysAskTools.length > 0) {
        channelConfig['alwaysAskTools'] = alwaysAskTools;
      }
    }
    if (approvalTimeoutSec !== 60) {
      channelConfig['approvalTimeoutSec'] = approvalTimeoutSec;
    }

    existingChannels[name] = channelConfig;
    settings.setValue(SettingScope.User, 'channels', existingChannels);

    writeStdoutLine('');
    writeStdoutLine(`  Channel "${name}" saved to ${USER_SETTINGS_PATH}`);
    writeStdoutLine('');
    writeStdoutLine('  Make sure to set the TELEGRAM_BOT_TOKEN environment variable:');
    writeStdoutLine('    export TELEGRAM_BOT_TOKEN=your-bot-token-here');
    writeStdoutLine('');
    writeStdoutLine('  Then start the channel:');
    writeStdoutLine(`    vivekmind channel start ${name}`);
    writeStdoutLine('');
    writeStdoutLine('  Or start all configured channels:');
    writeStdoutLine('    vivekmind channel start');
  } finally {
    rl.close();
  }
}

async function configureTelegramFromArgs(options: {
  name: string;
  token?: string;
  model?: string;
  cwd?: string;
  allowedUsers?: string[];
  open: boolean;
  remove: boolean;
}): Promise<void> {
  const { name, token, model, cwd, allowedUsers, open, remove } = options;

  if (remove) {
    // Remove channel
    const settings = loadSettings(process.cwd());
    const existingChannels = (settings.merged.channels || {}) as Record<
      string,
      unknown
    >;
    if (!existingChannels[name]) {
      writeStderrLine(`Error: Channel "${name}" not found in settings.`);
      process.exit(1);
    }
    delete existingChannels[name];
    settings.setValue(SettingScope.User, 'channels', existingChannels);
    writeStdoutLine(`Channel "${name}" removed from settings.`);
    return;
  }

  // Validate token
  const resolvedToken = token || process.env['TELEGRAM_BOT_TOKEN'];
  if (!resolvedToken) {
    writeStderrLine(
      'Error: No bot token provided. Use --token or set TELEGRAM_BOT_TOKEN environment variable.',
    );
    process.exit(1);
  }

  // Validate token by calling getMe
  writeStdoutLine('Validating bot token...');
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${resolvedToken}/getMe`,
    );
    if (!resp.ok) {
      const body = await resp.text();
      writeStderrLine(
        `Error: Invalid bot token. Telegram API returned: ${resp.status} ${body}`,
      );
      process.exit(1);
    }
    const data = (await resp.json()) as { ok: boolean; result?: { id: number; username: string; first_name: string } };
    if (data.ok && data.result) {
      writeStdoutLine(
        `Bot verified: @${data.result.username} (${data.result.first_name})`,
      );
    } else {
      writeStderrLine('Error: Unexpected response from Telegram API.');
      process.exit(1);
    }
  } catch (err) {
    writeStderrLine(
      `Error: Could not reach Telegram API. ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  // Build config
  const settings = loadSettings(process.cwd());
  const existingChannels = (settings.merged.channels || {}) as Record<
    string,
    Record<string, unknown>
  >;

  const channelConfig: Record<string, unknown> = {
    type: 'telegram',
    token: '$TELEGRAM_BOT_TOKEN',
  };

  if (model) {
    channelConfig['model'] = model;
  }
  if (cwd) {
    channelConfig['cwd'] = cwd;
  }
  if (allowedUsers && allowedUsers.length > 0) {
    channelConfig['allowedUsers'] = allowedUsers;
    channelConfig['senderPolicy'] = 'allowlist';
  }
  if (open) {
    channelConfig['senderPolicy'] = 'open';
  }

  const isUpdate = !!existingChannels[name];
  existingChannels[name] = channelConfig;
  settings.setValue(SettingScope.User, 'channels', existingChannels);

  writeStdoutLine(
    isUpdate
      ? `Channel "${name}" updated in ${USER_SETTINGS_PATH}.`
      : `Channel "${name}" added to ${USER_SETTINGS_PATH}.`,
  );
  writeStdoutLine('');
  writeStdoutLine('Make sure TELEGRAM_BOT_TOKEN is set, then run:');
  writeStdoutLine(`  vivekmind channel start ${name}`);
}

export const configureTelegramCommand: CommandModule<
  object,
  {
    name?: string;
    token?: string;
    model?: string;
    cwd?: string;
    'allowed-users'?: string[];
    open?: boolean;
    remove?: boolean;
  }
> = {
  command: 'configure-telegram [name]',
  describe:
    'Configure a Telegram channel (interactive if only name given, or use flags)',
  builder: (yargs: Argv) =>
    yargs
      .positional('name', {
        type: 'string',
        describe:
          'Channel name (identifier). If provided without other flags, enters interactive mode.',
      })
      .option('token', {
        type: 'string',
        describe:
          'Telegram bot token from @BotFather. Saved as $TELEGRAM_BOT_TOKEN ref in settings.',
      })
      .option('model', {
        type: 'string',
        describe:
          'Model to use for this channel (defaults to your main configured model).',
      })
      .option('cwd', {
        type: 'string',
        describe: 'Working directory for the agent (defaults to current directory).',
      })
      .option('allowed-users', {
        type: 'array',
        string: true,
        describe:
          'Comma-separated list of allowed Telegram user IDs (enables allowlist mode).',
      })
      .option('open', {
        type: 'boolean',
        default: false,
        describe:
          'Allow anyone to message the bot (open access, no allowlist).',
      })
      .option('remove', {
        type: 'boolean',
        default: false,
        describe: 'Remove the named channel from settings.',
      })
      .example(
        '$0 channel configure-telegram my-bot',
        'Interactive setup for channel "my-bot"',
      )
      .example(
        '$0 channel configure-telegram my-bot --token 123456:ABC-DEF --open',
        'Quick setup with token and open access',
      )
      .example(
        '$0 channel configure-telegram my-bot --remove',
        'Remove channel "my-bot" from settings',
      ),
  handler: async (argv) => {
    const { name, token, model, cwd, open, remove } = argv;

    if (!name) {
      // No name at all - start fully interactive mode
      await configureTelegramInteractive();
      return;
    }

    // Name provided with --remove
    if (remove) {
      await configureTelegramFromArgs({
        name,
        token,
        model,
        cwd,
        allowedUsers: argv['allowed-users'] as string[] | undefined,
        open: open ?? false,
        remove: true,
      });
      return;
    }

    // Name provided with at least --token - non-interactive mode
    if (token || process.env['TELEGRAM_BOT_TOKEN']) {
      await configureTelegramFromArgs({
        name,
        token,
        model,
        cwd,
        allowedUsers: argv['allowed-users'] as string[] | undefined,
        open: open ?? false,
        remove: false,
      });
      return;
    }

    // Name without token - interactive mode (pass the name to avoid re-asking)
    await configureTelegramInteractive(name);
  },
};
