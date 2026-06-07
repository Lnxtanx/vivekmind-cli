# @vivekmind/channel-telegram

Telegram Bot channel adapter for **VivekMind**, powered by [grammY](https://grammy.dev/). Connect VivekMind directly to Telegram to interact with your AI coding agent from any device.

## Features

- **Interactive Bot Commands:** Use `/clear` to reset the session, `/status` to see session details, `/approval` to change permissions, and other standard commands.
- **Interactive Tool Approvals:** When VivekMind wants to execute a write or shell command, it presents a Telegram inline keyboard (Allow Once, Always Allow, Deny) for you to review and approve/reject the tool call directly from chat.
- **Interactive Question Dialogs:** Handles `askUserQuestion` prompts by rendering multi-choice/numbered question buttons inline.
- **Real-Time Status Display:** Overhauled progress card notifications with:
  - **Thinking Indicator:** Displays a dynamic `> Thinking...` status when the agent begins processing a prompt.
  - **Text-Based Status Labels:** Shows each tool call on its own line: `  {toolIcon} [tool_name] status` (e.g. `🔍 [read_file] completed`, `✏️ [write_file] in progress`) without cluttered status emojis.
  - **Truncation and Scrolling:** Automatically caps visible tools to 8 lines, collapsing older calls under `+N more`.
  - **Elapsed Duration:** Displays elapsed execution seconds and status counts in the footer.
  - **Auto-Cleanup:** Edits card to `> Done — X tools completed in Ys` and auto-deletes it after 5 seconds, or instantly clears it when the agent starts streaming text responses.
- **Rich Media & Attachments:** Supports sending/receiving images, voice messages, files, and documents.

## Installation

```bash
npm install @vivekmind/channel-telegram
```

## Setup & Configuration

### 1. Create a Bot
1. Search for `@BotFather` on Telegram and start a chat.
2. Send `/newbot` and follow the instructions to get your **Bot API Token**.

### 2. Configure VivekMind
Add a new channel config block to `~/.vivekmind/settings.json`:

```json
{
  "channels": {
    "my-telegram-bot": {
      "type": "telegram",
      "token": "YOUR_TELEGRAM_BOT_TOKEN",
      "cwd": "/path/to/your/project",
      "senderPolicy": "pairing",
      "sessionScope": "user",
      "approvalMode": "ask",
      "approvalPolicy": "auto_edit"
    }
  }
}
```

#### Settings Reference:
- `token`: Your Telegram Bot API Token.
- `cwd`: The workspace path where the agent will run.
- `senderPolicy`: Access control. Set to `'pairing'` (recommended), `'allowlist'`, or `'open'`.
- `sessionScope`: `'user'` (individual chat per user), `'thread'` (separate chat session per thread), or `'single'`.
- `approvalMode`: `'ask'` (interactive confirmation for tools), `'allow'` (auto-approve all), or `'deny'` (auto-deny all).
- `approvalPolicy`: `'auto_edit'` (automatically approve read-only tools, ask for execution/writes) or `'ask'` (always ask for approval).

### 3. Start the Channel
Run this command from your terminal:
```bash
vivekmind channel start my-telegram-bot
```

### 4. Interactive Pairing
If `senderPolicy` is set to `'pairing'`:
1. Open your Telegram bot chat and send any message.
2. The bot will reply with a unique 8-character pairing code.
3. Run the following command in your terminal to approve access:
   ```bash
   vivekmind channel pairing approve my-telegram-bot CODE
   ```
4. Once paired, you can chat with VivekMind directly!

## Development & Build

```bash
# Build the TypeScript files
npm run build
```
