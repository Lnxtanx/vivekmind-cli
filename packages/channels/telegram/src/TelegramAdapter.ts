import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Bot, InlineKeyboard } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  telegramFormat,
  splitHtmlForTelegram,
} from 'telegram-markdown-formatter';
import { ChannelBase } from '@vivekmind/channel-base';
import type {
  ChannelConfig,
  ChannelBaseOptions,
  Envelope,
  AcpBridge,
  ToolCallEvent,
} from '@vivekmind/channel-base';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@agentclientprotocol/sdk';

interface PendingApproval {
  resolve: (response: RequestPermissionResponse) => void;
  timer: ReturnType<typeof setTimeout>;
  chatId: string;
  messageId: number;
}

interface ToolStatusEntry {
  messageId: number;
  toolCount: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** Whether a flush is already in progress */
  flushing: boolean;
  /** Latest status for each tool name */
  toolStatuses: Map<string, { status: string; kind: string }>;
}

/** Read-only / informational tools that are safe to auto-approve in 'auto_edit' mode */
const DEFAULT_AUTO_APPROVE_KINDS = new Set([
  'read',
  'search',
  'think',
  'fetch',
]);

/** Default tool kinds that always require approval even in auto_edit mode */
const DEFAULT_ALWAYS_ASK_KINDS = new Set([
  'execute',
  'edit',
  'delete',
  'move',
]);

/** Map tool kinds to emoji icons for status notifications */
function toolIcon(kind: string): string {
  if (kind === 'read') return '🔍';
  if (kind === 'edit') return '✏️';
  if (kind === 'execute') return '💻';
  if (kind === 'search') return '🔎';
  if (kind === 'fetch') return '🌐';
  if (kind === 'delete') return '🗑️';
  if (kind === 'move') return '📁';
  if (kind === 'think') return '💭';
  return '⚙️';
}

/** Truncate a string, adding ellipsis if needed */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

export class TelegramChannel extends ChannelBase {
  private bot: Bot;
  private botId: number = 0;
  private botUsername: string = '';

  /** Track pending approval requests awaiting user response */
  private pendingApprovals: Map<string, PendingApproval> = new Map();

  /** Track tool call status messages per chat (for Phase 2 notifications) */
  private toolStatusMap: Map<string, ToolStatusEntry> = new Map();

  /** Debounce interval for batching rapid tool calls (ms) */
  private static readonly TOOL_STATUS_DEBOUNCE_MS = 2000;

  constructor(
    name: string,
    config: ChannelConfig,
    bridge: AcpBridge,
    options?: ChannelBaseOptions,
  ) {
    super(name, config, bridge, options);
    const botConfig = this.proxy
      ? {
          client: {
            baseFetchConfig: { agent: new HttpsProxyAgent(this.proxy) },
          },
        }
      : undefined;
    this.bot = new Bot(config.token, botConfig);
  }

  // ─── Phase 1: Interactive Tool Approvals ──────────────────────────────

  /**
   * Override the default approval handler to present an interactive
   * Telegram inline keyboard to the user.
   */
  protected override async onToolCallApproval(
    chatId: string,
    event: ToolCallEvent,
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    // Check approval policy — if 'yolo', auto-approve immediately
    const policy = this.config.approvalPolicy || 'ask';
    if (policy === 'yolo') {
      return {
        outcome: { outcome: 'selected', optionId: 'proceed_once' },
      };
    }

    const toolCall = params.toolCall;
    const toolKind = toolCall?.kind || event.kind || '';
    const toolTitle = toolCall?.title || event.title || 'Tool Call';
    const rawInput = toolCall?.rawInput as Record<string, unknown> | undefined;

    // Check auto-approve and always-ask tool lists
    const autoApproveTools = this.config.autoApproveTools?.length
      ? new Set(this.config.autoApproveTools)
      : null;
    const alwaysAskTools = this.config.alwaysAskTools?.length
      ? new Set(this.config.alwaysAskTools)
      : null;

    // For 'auto_edit' mode: auto-approve read-only tools, ask for writes/exec
    if (policy === 'auto_edit') {
      const isAutoApprove = autoApproveTools
        ? autoApproveTools.has(event.kind)
        : DEFAULT_AUTO_APPROVE_KINDS.has(toolKind);
      const isAlwaysAsk = alwaysAskTools
        ? alwaysAskTools.has(event.kind)
        : DEFAULT_ALWAYS_ASK_KINDS.has(toolKind);

      if (isAutoApprove && !isAlwaysAsk) {
        return {
          outcome: { outcome: 'selected', optionId: 'proceed_once' },
        };
      }
    }

    // If specific autoApproveTools are configured (even in 'ask' mode), check them
    if (autoApproveTools && autoApproveTools.has(event.kind)) {
      return {
        outcome: { outcome: 'selected', optionId: 'proceed_once' },
      };
    }

    // Build a human-readable message for the approval request
    const requestId = `${toolCall?.toolCallId || event.toolCallId}:${Date.now()}`;

    // ─── Phase 4: askUserQuestion support ─────────────────────────
    // Detect ask_user_question by checking rawInput for a questions array
    const rawQuestions = rawInput?.['questions'] as
      | Array<{
          question: string;
          header: string;
          options: Array<{ label: string; description: string }>;
          multiSelect?: boolean;
        }>
      | undefined;
    if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
      return this.handleAskUserQuestion(
        chatId,
        requestId,
        rawQuestions,
      );
    }

    // ─── Regular tool approval ────────────────────────────────────

    // Build the message text
    let message = `<b>🔓 Permission Required</b>\n\n`;
    message += `<b>Tool:</b> ${this.escapeHtml(toolTitle)}\n`;

    // Show tool call description from title
    // (Content blocks are deeply nested unions — title is sufficient for approval UI)
    if (toolTitle !== 'Tool Call') {
      message += `<b>What:</b> ${this.escapeHtml(toolTitle)}\n`;
    }

    // For execute (shell) commands, try to extract the command
    if (toolKind === 'execute') {
      const cmd =
        (rawInput?.['command'] as string) ||
        (rawInput?.['cmd'] as string) ||
        '';
      if (cmd) {
        message += `<b>Command:</b>\n<code>${this.escapeHtml(truncate(cmd, 300))}</code>\n`;
      }
    }

    // For file operations, show the file path
    if (toolKind === 'edit' || toolKind === 'read' || toolKind === 'delete') {
      const path =
        (rawInput?.['path'] as string) ||
        (rawInput?.['file_path'] as string) ||
        '';
      if (path) {
        message += `<b>File:</b> <code>${this.escapeHtml(path)}</code>\n`;
      }
    }

    // Build inline keyboard from permission options
    const options = Array.isArray(params.options) ? params.options : [];
    const keyboard = new InlineKeyboard();

    for (const option of options) {
      const kind = option.kind;
      const name = option.name;

      if (kind === 'allow_once') {
        keyboard.text(`✅ ${name || 'Allow Once'}`, `approve_once:${requestId}`);
      } else if (kind === 'allow_always') {
        keyboard.text(`🔄 ${name || 'Allow Always'}`, `approve_always:${requestId}`);
      } else if (kind === 'reject_once') {
        keyboard.text(`❌ ${name || 'Deny'}`, `deny_once:${requestId}`);
      } else if (kind === 'reject_always') {
        keyboard.text(`🚫 ${name || 'Deny Always'}`, `deny_always:${requestId}`);
      } else {
        // Generic fallback — use the optionId
        keyboard.text(name || option.optionId, `option:${option.optionId}:${requestId}`);
      }
    }

    // Ensure at least Allow Once and Deny buttons exist
    if (!keyboard.inline_keyboard || keyboard.inline_keyboard.length === 0) {
      keyboard.text('✅ Allow Once', `approve_once:${requestId}`).row();
      keyboard.text('❌ Deny', `deny_once:${requestId}`);
    } else {
      // Ensure Deny exists as a separate row
      keyboard.row();
      keyboard.text('❌ Deny', `deny_once:${requestId}`);
    }

    const timeoutSec = this.config.approvalTimeoutSec || 60;

    // Send the approval message
    const sentMsg = await this.bot.api.sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });

    // Return a promise that resolves when the user clicks a button
    return new Promise<RequestPermissionResponse>((resolve) => {
      const timer = setTimeout(() => {
        // Auto-deny on timeout
        this.pendingApprovals.delete(requestId);
        resolve({ outcome: { outcome: 'cancelled' } });
        // Edit the message to show timeout
        this.bot.api
          .editMessageText(
            chatId,
            sentMsg.message_id,
            `${message}\n\n<i>⏰ Timed out — auto-denied</i>`,
            { parse_mode: 'HTML' },
          )
          .catch(() => {
            // Message may have been deleted; ignore
          });
      }, timeoutSec * 1000);

      this.pendingApprovals.set(requestId, {
        resolve,
        timer,
        chatId,
        messageId: sentMsg.message_id,
      });
    });
  }

  // ─── Phase 4: askUserQuestion Formatting ─────────────────────────────

  /**
   * Handle askUserQuestion tool calls by presenting questions with
   * option buttons in an inline keyboard instead of approve/deny.
   */
  private async handleAskUserQuestion(
    chatId: string,
    requestId: string,
    questions: Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description: string }>;
      multiSelect?: boolean;
    }>,
  ): Promise<RequestPermissionResponse> {
    // Build message with questions
    let message = `<b>\u2753 Question${questions.length > 1 ? 's' : ''}</b>\n\n`;

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi]!;
      if (questions.length > 1) {
        message += `<b>[${this.escapeHtml(q.header || `Q${qi + 1}`)}]</b> `;
      }
      message += `${this.escapeHtml(q.question)}\n\n`;

      // Show options as numbered list so user knows what the buttons mean
      for (let oi = 0; oi < q.options.length; oi++) {
        const opt = q.options[oi]!;
        message +=
          `  <b>${oi + 1}.</b> ${this.escapeHtml(opt.label)} \u2014 <i>${this.escapeHtml(opt.description)}</i>\n`;
      }
      message += '\n';
    }

    // Build inline keyboard with option buttons per question
    const keyboard = new InlineKeyboard();

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi]!;
      for (let oi = 0; oi < q.options.length; oi++) {
        const opt = q.options[oi]!;
        const callbackData = `question:${requestId}:${qi}:${oi}`;
        keyboard.text(`${oi + 1}. ${opt.label}`, callbackData);
        if (oi < q.options.length - 1) {
          keyboard.row();
        }
      }
      if (qi < questions.length - 1) {
        keyboard.row();
      }
    }

    // Add Cancel button at the bottom
    keyboard.row();
    keyboard.text('\u274C Cancel', `question_cancel:${requestId}`);

    const timeoutSec = this.config.approvalTimeoutSec || 120;

    const sentMsg = await this.bot.api.sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });

    return new Promise<RequestPermissionResponse>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(requestId);
        resolve({ outcome: { outcome: 'cancelled' } });
        this.bot.api
          .editMessageText(
            chatId,
            sentMsg.message_id,
            `${message}\n<i>\u23F0 Timed out \u2014 cancelled</i>`,
            { parse_mode: 'HTML' },
          )
          .catch(() => {});
      }, timeoutSec * 1000);

      this.pendingApprovals.set(requestId, {
        resolve,
        timer,
        chatId,
        messageId: sentMsg.message_id,
      });
    });
  }

  // ─── Phase 2: Tool Call Notifications ─────────────────────────────────

  /**
   * Override onToolCall to show status messages for non-approval tool calls.
   * Groups rapid tool calls using a debounce timer.
   */
  override onToolCall(chatId: string, event: ToolCallEvent): void {
    // Don't show notifications for approval requests (handled by onToolCallApproval)
    if (event.status === 'pending_request') return;

    const toolName = event.title || event.kind || 'tool';

    let entry = this.toolStatusMap.get(chatId);

    if (!entry) {
      entry = {
        messageId: 0,
        toolCount: 0,
        timer: null,
        flushing: false,
        toolStatuses: new Map(),
      };
      this.toolStatusMap.set(chatId, entry);
    }

    // Track this tool's latest status
    entry.toolStatuses.set(toolName, {
      status: event.status,
      kind: event.kind,
    });
    entry.toolCount++;

    // Determine action based on status
    if (event.status === 'completed') {
      this.flushToolStatus(chatId, entry, event.status);
    } else if (event.status === 'failed' || event.status === 'error') {
      this.flushToolStatus(chatId, entry, event.status);
    } else if (event.status === 'running' || event.status === 'pending' || event.status === 'in_progress') {
      // Tool started — debounce to batch rapid starts
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.timer = setTimeout(() => {
        this.flushToolStatus(chatId, entry!, null);
      }, TelegramChannel.TOOL_STATUS_DEBOUNCE_MS);
    }
  }

  /**
   * Flush accumulated tool status updates to a Telegram message.
   */
  private async flushToolStatus(
    chatId: string,
    entry: ToolStatusEntry,
    overrideStatus: string | null,
  ): Promise<void> {
    if (entry.flushing) return;

    // Clear any pending debounce timer
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    // Check if there are still running tools (don't clear the message yet)
    const completedStatuses = new Set(['completed', 'failed', 'error']);
    let hasRunningTools = false;
    for (const [, info] of entry.toolStatuses) {
      if (!completedStatuses.has(info.status)) {
        hasRunningTools = true;
        break;
      }
    }

    // Build status message
    const lines: string[] = [];
    const count = entry.toolStatuses.size;

    if (count === 1) {
      const [name, info] = entry.toolStatuses.entries().next().value!;
      const statusEmoji = info.status === 'completed' ? '✅' : info.status === 'failed' || info.status === 'error' ? '❌' : '⏳';
      lines.push(
        `${statusEmoji} ${toolIcon(info.kind)} <b>${this.escapeHtml(name)}</b> — ${this.escapeHtml(overrideStatus || info.status)}`,
      );
    } else {
      if (count > 1) {
        lines.push(`<b>${count} tools running:</b>`);
      }
      for (const [name, info] of entry.toolStatuses) {
        const statusEmoji = info.status === 'completed' ? '✅' : info.status === 'failed' || info.status === 'error' ? '❌' : '⏳';
        lines.push(
          `  ${statusEmoji} ${toolIcon(info.kind)} ${this.escapeHtml(name)}`,
        );
      }
    }
    const message = lines.join('\n');

    entry.flushing = true;
    try {
      if (entry.messageId) {
        // Edit existing message
        try {
          await this.bot.api.editMessageText(chatId, entry.messageId, message, {
            parse_mode: 'HTML',
          });
        } catch {
          // Message may have been deleted — send a new one
          entry.messageId = 0;
        }
      }

      if (!entry.messageId) {
        const sentMsg = await this.bot.api.sendMessage(chatId, message, {
          parse_mode: 'HTML',
        });
        entry.messageId = sentMsg.message_id;
      }

      // If no tools are running anymore, clean up after a short delay
      if (!hasRunningTools) {
        setTimeout(() => {
          // Only delete if no new tools have started since
          const currentEntry = this.toolStatusMap.get(chatId);
          if (currentEntry === entry) {
            // Try to delete the status message to keep chat clean
            this.bot.api
              .deleteMessage(chatId, entry.messageId)
              .catch(() => {
                // Ignore — might have already been deleted or too old
              });
            this.toolStatusMap.delete(chatId);
          }
        }, 3000);
      } else {
        // Reset counter but keep tracking
        entry.toolCount = 0;
      }
    } catch {
      // Silently ignore — sending/editing can fail for various reasons
    } finally {
      entry.flushing = false;
    }
  }

  // ─── Connection & Message Handling ────────────────────────────────────

  private getFileUrl(filePath: string): string {
    return `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;
  }

  async connect(): Promise<void> {
    const botInfo = await this.bot.api.getMe();
    this.botId = botInfo.id;
    this.botUsername = botInfo.username ?? '';

    // ─── Callback query handler for approval buttons ──────────────────
    this.bot.callbackQuery(/^approve_|^deny_|^option:/, async (ctx) => {
      const data = ctx.callbackQuery.data;
      const colonIdx = data.indexOf(':');
      if (colonIdx === -1) {
        await ctx.answerCallbackQuery();
        return;
      }

      const action = data.slice(0, colonIdx);
      let requestId: string;
      let customOptionId: string | undefined;

      if (action === 'option') {
        // Format: option:optionId:requestId
        const secondColon = data.indexOf(':', colonIdx + 1);
        if (secondColon === -1) {
          await ctx.answerCallbackQuery();
          return;
        }
        customOptionId = data.slice(colonIdx + 1, secondColon);
        requestId = data.slice(secondColon + 1);
      } else {
        requestId = data.slice(colonIdx + 1);
      }

      const pending = this.pendingApprovals.get(requestId);

      if (!pending) {
        await ctx.answerCallbackQuery({ text: 'This request has expired.' });
        return;
      }

      // Clean up the pending approval
      clearTimeout(pending.timer);
      this.pendingApprovals.delete(requestId);

      // Build response based on action
      let response: RequestPermissionResponse;
      let resultText: string;

      switch (action) {
        case 'approve_once':
          response = {
            outcome: { outcome: 'selected', optionId: 'proceed_once' },
          };
          resultText = '✅ Approved (once)';
          break;
        case 'approve_always':
          response = {
            outcome: { outcome: 'selected', optionId: 'proceed_always' },
          };
          resultText = '🔄 Approved (always)';
          break;
        case 'deny_once':
          response = { outcome: { outcome: 'cancelled' } };
          resultText = '❌ Denied';
          break;
        case 'deny_always':
          response = { outcome: { outcome: 'cancelled' } };
          resultText = '🚫 Denied (always)';
          break;
        case 'option':
          response = {
            outcome: { outcome: 'selected', optionId: customOptionId || 'proceed_once' },
          };
          resultText = `✅ ${customOptionId || 'Approved'}`;
          break;
        default:
          response = { outcome: { outcome: 'cancelled' } };
          resultText = '❌ Denied';
      }

      // Answer the callback query to remove the loading state
      await ctx.answerCallbackQuery({ text: resultText });

      // Edit the original message to show the decision
      try {
        // Remove the inline keyboard and update the message
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.editMessageText(
          `${ctx.msg?.text || ''}\n\n<i>${resultText}</i>`,
          {
            parse_mode: 'HTML',
          },
        );
      } catch {
        // Message may have been edited or deleted — ignore
      }

      // Resolve the promise to unblock the bridge
      pending.resolve(response);
    });

    // ─── Callback query handler for askUserQuestion cancel ────────
    this.bot.callbackQuery(/^question_cancel/, async (ctx) => {
      const data = ctx.callbackQuery.data;
      const colonIdx = data.indexOf(':');
      if (colonIdx === -1) {
        await ctx.answerCallbackQuery();
        return;
      }
      const requestId = data.slice(colonIdx + 1);
      const pending = this.pendingApprovals.get(requestId);
      if (!pending) {
        await ctx.answerCallbackQuery({ text: 'This request has expired.' });
        return;
      }
      clearTimeout(pending.timer);
      this.pendingApprovals.delete(requestId);
      await ctx.answerCallbackQuery({ text: '❌ Cancelled' });
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.editMessageText(
          `${ctx.msg?.text || ''}\n\n<i>❌ Cancelled</i>`,
          { parse_mode: 'HTML' },
        );
      } catch {
        // ignore
      }
      pending.resolve({ outcome: { outcome: 'cancelled' } });
    });

    // ─── Callback query handler for askUserQuestion option selection ─
    this.bot.callbackQuery(/^question:/, async (ctx) => {
      const data = ctx.callbackQuery.data;
      // Expected format: question:<requestId>:<questionIndex>:<optionIndex>
      const parts = data.split(':');
      if (parts.length < 4) {
        await ctx.answerCallbackQuery();
        return;
      }
      const requestId = parts[1]!;
      const questionIndex = parseInt(parts[2]!, 10);
      const optionIndex = parseInt(parts[3]!, 10);
      const pending = this.pendingApprovals.get(requestId);
      if (!pending) {
        await ctx.answerCallbackQuery({ text: 'This request has expired.' });
        return;
      }
      clearTimeout(pending.timer);
      this.pendingApprovals.delete(requestId);

      const selectedText = `Selected option ${optionIndex + 1}`;
      await ctx.answerCallbackQuery({ text: `✅ ${selectedText}` });

      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.editMessageText(
          `${ctx.msg?.text || ''}\n\n<i>✅ ${selectedText}</i>`,
          { parse_mode: 'HTML' },
        );
      } catch {
        // ignore
      }

      // Build answers payload: { "0": "1", ... } mapping question index to selected option number
      const answers: Record<string, string> = {
        [String(questionIndex)]: String(optionIndex + 1),
      };
      pending.resolve({
        outcome: { outcome: 'selected', optionId: 'proceed_once' },
        ...(Object.keys(answers).length > 0 ? { answers } : {}),
      });
    });

    // All messages (including slash commands) go through handleInbound
    // where ChannelBase dispatches shared commands (/help, /clear, /status, etc.)
    this.bot.on('message:text', async (ctx) => {
      const msg = ctx.message;
      const text = msg.text;

      const envelope = this.buildEnvelope(msg, text, msg.entities);

      // Don't await — long prompts would block the update loop
      this.handleInbound(envelope).catch((err) => {
        process.stderr.write(
          `[Telegram:${this.name}] Error handling message: ${err}\n`,
        );
        ctx
          .reply('Sorry, something went wrong processing your message.')
          .catch(() => {});
      });
    });

    // Photo messages
    this.bot.on('message:photo', async (ctx) => {
      const msg = ctx.message;
      const envelope = this.buildEnvelope(
        msg,
        msg.caption || '(image)',
        msg.caption_entities,
      );

      // Pick the largest photo size (last in array)
      const photo = msg.photo[msg.photo.length - 1];
      if (!photo) return;

      try {
        const file = await ctx.api.getFile(photo.file_id);
        const fileUrl = this.getFileUrl(file.file_path!);
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        envelope.imageBase64 = buf.toString('base64');
        envelope.imageMimeType = 'image/jpeg'; // Telegram always converts photos to JPEG
      } catch (err) {
        process.stderr.write(
          `[Telegram:${this.name}] Failed to download photo: ${err instanceof Error ? err.message : err}\n`,
        );
      }

      this.handleInbound(envelope).catch((err) => {
        process.stderr.write(
          `[Telegram:${this.name}] Error handling message: ${err}\n`,
        );
        ctx
          .reply('Sorry, something went wrong processing your message.')
          .catch(() => {});
      });
    });

    // Document/file messages
    this.bot.on('message:document', async (ctx) => {
      const msg = ctx.message;
      const doc = msg.document;
      const fileName = doc.file_name || `file_${Date.now()}`;

      const envelope = this.buildEnvelope(
        msg,
        msg.caption || `(file: ${fileName})`,
        msg.caption_entities,
      );

      try {
        const file = await ctx.api.getFile(doc.file_id);
        const fileUrl = this.getFileUrl(file.file_path!);
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());

        // Save to temp dir so the agent can read it via read-file tool
        const dir = join(tmpdir(), 'channel-files', randomUUID());
        mkdirSync(dir, { recursive: true });
        const filePath = join(dir, basename(fileName) || `file_${Date.now()}`);
        writeFileSync(filePath, buf);

        envelope.text = msg.caption || '';
        envelope.attachments = [
          {
            type: 'file',
            filePath,
            mimeType: doc.mime_type || 'application/octet-stream',
            fileName,
          },
        ];
      } catch (err) {
        process.stderr.write(
          `[Telegram:${this.name}] Failed to download document: ${err instanceof Error ? err.message : err}\n`,
        );
        envelope.text =
          (msg.caption || '') +
          `\n\n(User sent a file "${fileName}" but download failed)`;
      }

      this.handleInbound(envelope).catch((err) => {
        process.stderr.write(
          `[Telegram:${this.name}] Error handling message: ${err}\n`,
        );
        ctx
          .reply('Sorry, something went wrong processing your message.')
          .catch(() => {});
      });
    });

    // Voice messages
    this.bot.on('message:voice', async (ctx) => {
      const msg = ctx.message;
      const voice = msg.voice;
      const fileName = `voice_${Date.now()}.ogg`;

      const envelope = this.buildEnvelope(
        msg,
        msg.caption || '(voice message)',
        msg.caption_entities,
      );

      try {
        const file = await ctx.api.getFile(voice.file_id);
        const fileUrl = this.getFileUrl(file.file_path!);
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());

        // Save to temp dir so the agent can read it via read-file tool
        const dir = join(tmpdir(), 'channel-files', randomUUID());
        mkdirSync(dir, { recursive: true });
        const filePath = join(dir, fileName);
        writeFileSync(filePath, buf);

        envelope.text = msg.caption || '';
        envelope.attachments = [
          {
            type: 'audio',
            filePath,
            mimeType: voice.mime_type || 'audio/ogg',
            fileName,
          },
        ];
      } catch (err) {
        process.stderr.write(
          `[Telegram:${this.name}] Failed to download voice message: ${err instanceof Error ? err.message : err}\n`,
        );
        envelope.text =
          (msg.caption || '') +
          `\n\n(User sent a voice message but download failed)`;
      }

      this.handleInbound(envelope).catch((err) => {
        process.stderr.write(
          `[Telegram:${this.name}] Error handling message: ${err}\n`,
        );
        ctx
          .reply('Sorry, something went wrong processing your message.')
          .catch(() => {});
      });
    });

    this.bot.start({ drop_pending_updates: true }).catch((err) => {
      process.stderr.write(
        `[Telegram:${this.name}] Bot launch error: ${err}\n`,
      );
    });

    process.once('SIGINT', () => this.bot.stop());
    process.once('SIGTERM', () => this.bot.stop());
  }

  /** Per-chat typing interval — repeats every 4s since Telegram expires it after 5s. */
  private typingIntervals = new Map<string, ReturnType<typeof setInterval>>();

  protected override onPromptStart(chatId: string): void {
    // Clear any stale interval (shouldn't happen, but safe)
    const existing = this.typingIntervals.get(chatId);
    if (existing) clearInterval(existing);

    const sendTyping = () =>
      this.bot.api.sendChatAction(chatId, 'typing').catch(() => {});
    sendTyping();
    this.typingIntervals.set(chatId, setInterval(sendTyping, 4000));
  }

  protected override onPromptEnd(chatId: string): void {
    const interval = this.typingIntervals.get(chatId);
    if (interval) {
      clearInterval(interval);
      this.typingIntervals.delete(chatId);
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const html = telegramFormat(text);
    const chunks = splitHtmlForTelegram(html);
    for (const chunk of chunks) {
      try {
        await this.bot.api.sendMessage(chatId, chunk, {
          parse_mode: 'HTML',
        });
      } catch {
        // Fallback to plain text for the failed chunk only
        await this.bot.api.sendMessage(chatId, chunk.replace(/<[^>]*>/g, ''));
      }
    }
  }

  disconnect(): void {
    this.bot.stop();
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private buildEnvelope(
    msg: {
      from: { id: number; first_name: string; last_name?: string };
      chat: { id: number; type: string };
      reply_to_message?: { from?: { id: number }; text?: string };
    },
    text: string,
    entities?: Array<{ type: string; offset: number; length: number }>,
  ): Envelope {
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

    const isMentioned =
      entities?.some(
        (e) =>
          e.type === 'mention' &&
          this.botUsername &&
          text.slice(e.offset, e.offset + e.length).toLowerCase() ===
            `@${this.botUsername.toLowerCase()}`,
      ) ?? false;

    const isReplyToBot = msg.reply_to_message?.from?.id === this.botId;

    let cleanText = text;
    if (isMentioned && this.botUsername) {
      cleanText = text
        .replace(new RegExp(`@${this.botUsername}`, 'gi'), '')
        .trim();
    }

    // Extract referenced message text (when user replies to a message)
    const referencedText = msg.reply_to_message?.text || undefined;

    return {
      channelName: this.name,
      senderId: String(msg.from.id),
      senderName:
        msg.from.first_name +
        (msg.from.last_name ? ` ${msg.from.last_name}` : ''),
      chatId: String(msg.chat.id),
      text: cleanText,
      isGroup,
      isMentioned,
      isReplyToBot,
      referencedText,
    };
  }

  /** Escape HTML special characters */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
