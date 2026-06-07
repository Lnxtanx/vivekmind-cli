import type { AcpBridge } from './AcpBridge.js';
import type { ChannelBase, ChannelBaseOptions } from './ChannelBase.js';

export type SenderPolicy = 'allowlist' | 'pairing' | 'open';
export type SessionScope = 'user' | 'thread' | 'single';
export type ChannelType = string;
export type GroupPolicy = 'disabled' | 'allowlist' | 'open';
export type DispatchMode = 'collect' | 'steer' | 'followup';
export type ApprovalPolicy = 'ask' | 'yolo' | 'auto_edit';

export interface GroupConfig {
  requireMention?: boolean; // default: true
  dispatchMode?: DispatchMode;
  /** If true, only group admins can interact with the bot. Default: false */
  adminOnly?: boolean;
}

export interface BlockStreamingChunkConfig {
  /** Minimum characters before emitting a block. Default: 400. */
  minChars?: number;
  /** Force-emit when buffer exceeds this size. Default: 1000. */
  maxChars?: number;
}

export interface BlockStreamingCoalesceConfig {
  /** Emit buffered text after this many ms of inactivity. Default: 1500. */
  idleMs?: number;
}

export interface ChannelConfig {
  type: ChannelType;
  token: string;
  clientId?: string;
  clientSecret?: string;
  senderPolicy: SenderPolicy;
  allowedUsers: string[];
  sessionScope: SessionScope;
  cwd: string;
  approvalMode?: string;
  /**
   * Per-channel approval mode:
   * - 'ask' / 'interactive': prompts user for each tool call that requires permission
   * - 'yolo' / 'auto-approve': auto-approves all tool calls (no approval UI)
   * - 'auto_edit': auto-approves read-only/edit/info tools, asks for others
   * - 'ask-always': always prompt
   * Default: 'ask'
   */
  approvalPolicy?: ApprovalPolicy;
  /** Tools that are auto-approved. */
  autoApproveTools?: string[];
  instructions?: string;
  model?: string;
  groupPolicy: GroupPolicy; // default: "disabled"
  groups: Record<string, GroupConfig>; // "*" for defaults, group IDs for overrides

  /** Dispatch mode for concurrent messages. Default: 'collect'. */
  dispatchMode?: DispatchMode;

  /** Enable block streaming — emit completed blocks as separate messages. */
  blockStreaming?: 'on' | 'off';
  /** Chunk size bounds for block streaming. */
  blockStreamingChunk?: BlockStreamingChunkConfig;
  /** Idle coalescing for block streaming. */
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;

  /** Tools that always require approval even in auto_edit mode */
  alwaysAskTools?: string[];

  /** Approval timeout in seconds. Default: 60 */
  approvalTimeoutSec?: number;
}

export interface Attachment {
  /** Content category. */
  type: 'image' | 'file' | 'audio' | 'video';
  /** Base64-encoded data (for images or small files). */
  data?: string;
  /** Absolute path to a local file (for large files saved to disk). */
  filePath?: string;
  /** MIME type (e.g. "image/jpeg", "application/pdf"). */
  mimeType: string;
  /** Original file name from the platform. */
  fileName?: string;
}

export interface Envelope {
  channelName: string;
  senderId: string;
  senderName: string;
  chatId: string;
  text: string;
  threadId?: string;
  /** Platform-specific message ID for response correlation. */
  messageId?: string;
  isGroup: boolean;
  isMentioned: boolean;
  isReplyToBot: boolean;
  /** Text of the message being replied to (quoted/referenced message). */
  referencedText?: string;
  /** Base64-encoded image data (e.g. from WeChat CDN download). */
  imageBase64?: string;
  /** MIME type for the image (e.g. "image/jpeg", "image/png"). */
  imageMimeType?: string;
  /** Structured attachments (images, files, audio, video). */
  attachments?: Attachment[];
}

export interface SessionTarget {
  channelName: string;
  senderId: string;
  chatId: string;
  threadId?: string;
}

/**
 * Information about a tool permission request, sent from the agent
 * via ACP protocol to the channel for user approval.
 */
export interface ToolApprovalInfo {
  /** The ACP session ID. */
  sessionId: string;
  /** Unique ID for this tool call. */
  toolCallId: string;
  /** Tool category: 'edit', 'exec', 'mcp', 'info', 'plan', 'ask_user_question'. */
  kind: string;
  /** Human-readable description of the tool action. */
  title: string;
  /** Status of the tool call (usually 'pending'). */
  status: string;
  /** Raw input arguments for the tool. */
  rawInput?: Record<string, unknown>;
  /** Available permission options with labels (from the agent). */
  options: Array<{ optionId: string; name: string; kind: string }>;
  /** Structured content for display (diffs, text, etc.). */
  content?: Array<{
    type: string;
    path?: string;
    oldText?: string;
    newText?: string;
    content?: { type: string; text?: string };
  }>;
  /** File locations affected by the tool. */
  locations?: string[];
}

/**
 * Result of a user's tool approval decision.
 */
export interface ToolApprovalResult {
  /** The chosen option ID (e.g., 'proceed_once', 'cancel'). */
  optionId: string;
  /** Whether the request was cancelled (user dismissed). */
  cancelled?: boolean;
  /** Any user-provided answers (for ask_user_question type). */
  answers?: Record<string, string>;
}

/**
 * A channel plugin registers a channel type and provides a factory
 * to create adapter instances. Both built-in adapters and external
 * plugins conform to this interface.
 */
export interface ChannelPlugin {
  /** Unique channel type ID (e.g., "telegram", "tmcp-dingtalk"). */
  channelType: string;
 
  /** Human-readable name for CLI output. */
  displayName: string;

  /**
   * Config fields required by this channel type, beyond the shared
   * ChannelConfig fields. Validated at startup.
   */
  requiredConfigFields?: string[];

  /** Create a channel adapter instance. */
  createChannel(
    name: string,
    config: ChannelConfig & Record<string, unknown>,
    bridge: AcpBridge,
    options?: ChannelBaseOptions,
  ): ChannelBase;
}
