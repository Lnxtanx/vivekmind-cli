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
  PendingPermissionRequest,
  ToolCallEvent,
} from '@vivekmind/channel-base';

export class TelegramChannel extends ChannelBase {
  private bot: Bot;
  private botId: number = 0;
  private botUsername: string = '';

  /** Phase 1: Track pending approval messages for callback handling. */
  private pendingApprovals: Map<
    string,
    { chatId: string; messageId: number; permissionId: string }
  > = new Map();

  /** Phase 4: Track pending user question callbacks. */
  private pendingQuestions: Map<
    string,
    { chatId: string; messageId: number; resolve: (answer: string) => void }
  > = new Map();

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

    // Phase 5: Set approval mode from channel config
    const approvalMode = config.approvalMode || 'ask';
    if (approvalMode === 'ask') {
      bridge.setDefaultApprovalMode('ask');
    } else if (approvalMode === 'deny') {
      bridge.setDefaultApprovalMode('deny');
    } else {
      bridge.setDefaultApprovalMode('allow');
    }
  }

  private getFileUrl(filePath: string): string {
    return `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;
  }

  async connect(): Promise<void> {
    const botInfo = await this.bot.api.getMe();
    this.botId = botInfo.id;
    this.botUsername = botInfo.username ?? '';

    // Phase 1 + 4: Handle callback queries from inline keyboards
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const chatId = String(ctx.callbackQuery.message?.chat.id);

      try {
        if (data.startsWith('approve:')) {
          await this.handleApprovalCallback(data, chatId);
        } else if (data.startsWith('deny:')) {
          await this.handleDenyCallback(data, chatId);
        } else if (data.startsWith('qanswer:')) {
          await this.handleQuestionCallback(data, ctx);
        }
      } catch (err) {
        process.stderr.write(
          `[Telegram:${this.name}] Callback error: ${err}\n`,
        );
      }

      // Answer the callback query to remove loading state
      await ctx.answerCallbackQuery().catch(() => {});
    });

    // All messages (including slash commands) go through handleInbound
    this.bot.on('message:text', async (ctx) => {
      const msg = ctx.message;
      const text = msg.text;
      const envelope = this.buildEnvelope(msg, text, msg.entities);

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

      const photo = msg.photo[msg.photo.length - 1];
      if (!photo) return;

      try {
        const file = await ctx.api.getFile(photo.file_id);
        const fileUrl = this.getFileUrl(file.file_path!);
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        envelope.imageBase64 = buf.toString('base64');
        envelope.imageMimeType = 'image/jpeg';
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

  // ─────────────────────────────────────────────────────────
  // Phase 1: Interactive Tool Approvals (Inline Keyboard)
  // ─────────────────────────────────────────────────────────

  protected override onRequestPermission(
    chatId: string,
    request: PendingPermissionRequest,
  ): void {
    const toolLabel = request.toolName || request.description || 'Unknown tool';

    // Build inline keyboard with approval options
    const keyboard = new InlineKeyboard();
    keyboard
      .text('✅ Allow Once', `approve:${request.id}`)
      .text('✅ Always Allow', `approve:${request.id}:always`)
      .row()
      .text('❌ Deny', `deny:${request.id}`);

    const message =
      `⚠️ <b>Tool Permission Required</b>\n\n` +
      `🔧 <b>${toolLabel}</b>\n` +
      (request.description && request.description !== toolLabel
        ? `📝 ${request.description}\n`
        : '');

    this.bot.api
      .sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      })
      .then((sent) => {
        this.pendingApprovals.set(request.id, {
          chatId,
          messageId: sent.message_id,
          permissionId: request.id,
        });
      })
      .catch((err) => {
        process.stderr.write(
          `[Telegram:${this.name}] Failed to send approval prompt: ${err}\n`,
        );
        // Fallback: auto-approve on send failure
        this.bridge.resolvePermission(request.id, 'proceed_once');
      });
  }

  private async handleApprovalCallback(
    data: string,
    _chatId: string,
  ): Promise<void> {
    // data format: "approve:permissionId" or "approve:permissionId:always"
    const parts = data.split(':');
    const permissionId = parts[1];
    const always = parts[2] === 'always';

    const pending = this.pendingApprovals.get(permissionId);
    if (!pending) return;

    try {
      // Resolve the permission on the bridge
      const optionId = always ? 'proceed_always' : 'proceed_once';
      this.bridge.resolvePermission(permissionId, optionId);

      // Edit the message to show resolved state
      const emoji = always ? '✅ Always Allowed' : '✅ Allowed Once';
      await this.bot.api.editMessageText(
        pending.chatId,
        pending.messageId,
        `${emoji}\n\n🔧 ${permissionId.split(':')[0] || 'Tool'} — ${always ? 'permanently allowed' : 'allowed for this session'}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      process.stderr.write(
        `[Telegram:${this.name}] Approval callback error: ${err}\n`,
      );
    } finally {
      this.pendingApprovals.delete(permissionId);
    }
  }

  private async handleDenyCallback(
    data: string,
    _chatId: string,
  ): Promise<void> {
    // data format: "deny:permissionId"
    const permissionId = data.split(':')[1];
    const pending = this.pendingApprovals.get(permissionId);
    if (!pending) return;

    try {
      this.bridge.denyPermission(permissionId);

      await this.bot.api.editMessageText(
        pending.chatId,
        pending.messageId,
        `❌ <b>Denied</b>\n\n🔧 Tool call was rejected.`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      process.stderr.write(
        `[Telegram:${this.name}] Deny callback error: ${err}\n`,
      );
    } finally {
      this.pendingApprovals.delete(permissionId);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Phase 2: Tool Call Notifications (enhanced with status)
  // ─────────────────────────────────────────────────────────

  override onToolCall(chatId: string, event: ToolCallEvent): void {
    // Use status-specific formatting with more detail
    let msg: string;
    switch (event.status) {
      case 'pending':
        msg = `⏳ <b>Waiting</b>: ${event.kind}${event.title ? ` — ${event.title}` : ''}`;
        break;
      case 'running':
        msg = `🔧 <b>Running</b>: ${event.kind}${event.title ? ` — ${event.title}` : ''}`;
        break;
      case 'completed':
        msg = `✅ <b>Done</b>: ${event.kind}${event.title ? ` — ${event.title}` : ''}`;
        break;
      case 'error':
        msg = `❌ <b>Error</b>: ${event.kind}${event.title ? ` — ${event.title}` : ''}`;
        break;
      default:
        msg = `🔧 ${event.kind}: ${event.title}`;
    }

    this.bot.api
      .sendMessage(chatId, msg, { parse_mode: 'HTML' })
      .catch(() => {});
  }

  // ─────────────────────────────────────────────────────────
  // Phase 4: askUserQuestion Support on Telegram
  // ─────────────────────────────────────────────────────────

  /** Ask the user a question via Telegram inline keyboard. Returns the answer. */
  async askUser(chatId: string, question: string): Promise<string> {
    return new Promise((resolve) => {
      const questionId = `q:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      const keyboard = new InlineKeyboard();
      keyboard.text('💬 Reply to answer', `qanswer:${questionId}`);

      this.bot.api
        .sendMessage(chatId, `❓ <b>Question</b>\n\n${question}\n\nTap the button below, then reply to this message with your answer.`, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        })
        .then((sent) => {
          this.pendingQuestions.set(questionId, {
            chatId,
            messageId: sent.message_id,
            resolve,
          });
        })
        .catch(() => {
          resolve('');
        });
    });
  }

  private async handleQuestionCallback(
    data: string,
    ctx: import('grammy').Context,
  ): Promise<void> {
    const questionId = data.split(':')[1];
    const pending = this.pendingQuestions.get(questionId);
    if (!pending) return;

    // Edit the message to show the user they should reply
    try {
      await ctx.editMessageText(
        `💬 <b>Waiting for your reply...</b>\n\nPlease reply to this message with your answer.`,
        { parse_mode: 'HTML' },
      );
    } catch {
      // Message might not be editable, that's fine
    }
  }

  // ─────────────────────────────────────────────────────────
  // Typing indicators and message sending
  // ─────────────────────────────────────────────────────────

  private typingIntervals = new Map<string, ReturnType<typeof setInterval>>();

  protected override onPromptStart(chatId: string): void {
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
        await this.bot.api.sendMessage(chatId, chunk.replace(/<[^>]*>/g, ''));
      }
    }
  }

  disconnect(): void {
    this.bot.stop();
  }

  private buildEnvelope(
    msg: {
      from: { id: number; first_name: string; last_name?: string };
      chat: { id: number; type: string };
      reply_to_message?: { from?: { id: number }; text?: string; message_id?: number };
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

    // Phase 4: Check if this is a reply to a pending question
    if (msg.reply_to_message && isReplyToBot) {
      for (const [qId, pending] of this.pendingQuestions) {
        if (pending.messageId === msg.reply_to_message.message_id) {
          // This reply answers a pending question
          pending.resolve(cleanText);
          this.pendingQuestions.delete(qId);

          // Edit the question message to show answered state
          this.bot.api
            .editMessageText(pending.chatId, pending.messageId, `✅ <b>Answered</b>: ${cleanText}`, {
              parse_mode: 'HTML',
            })
            .catch(() => {});
          break;
        }
      }
    }

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
}
