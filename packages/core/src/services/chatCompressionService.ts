/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content } from '@google/genai';
import type { Config } from '../config/config.js';
import type { GeminiChat } from '../core/geminiChat.js';
import { type ChatCompressionInfo, CompressionStatus } from '../core/turn.js';
import { uiTelemetryService } from '../telemetry/uiTelemetry.js';
import { DEFAULT_TOKEN_LIMIT } from '../core/tokenLimits.js';
import { getCompressionPrompt } from '../core/prompts.js';
import { getResponseText } from '../utils/partUtils.js';
import { logChatCompression } from '../telemetry/loggers.js';
import { makeChatCompressionEvent } from '../telemetry/types.js';
import type { PermissionMode } from '../hooks/types.js';
import {
  SessionStartSource,
  PreCompactTrigger,
  PostCompactTrigger,
} from '../hooks/types.js';

/**
 * Threshold for compression token count as a fraction of the model's token limit.
 * If the chat history exceeds this threshold, it will be compressed.
 */
export const COMPRESSION_TOKEN_THRESHOLD = 0.7;

/**
 * The fraction of the latest chat history to keep. A value of 0.05
 * means that only the last 5% of the chat history will be kept after compression.
 * The kept portion will also have its tool outputs aggressively pruned.
 */
export const COMPRESSION_PRESERVE_THRESHOLD = 0.05;

/**
 * When manually triggered (/compress), use an even more aggressive preserve
 * threshold to maximize context recovery.
 */
export const FORCED_COMPRESSION_PRESERVE_THRESHOLD = 0.03;

/**
 * Maximum output tokens for the compression summary to force concise snapshots.
 * Without this, models produce verbose summaries that negate the compression.
 * 2048 tokens ≈ 1500 words, aligned with the compression prompt's word budget.
 */
export const COMPRESSION_MAX_OUTPUT_TOKENS = 2048;

/**
 * Maximum characters to retain per tool output in the kept history after compression.
 * Tool outputs (read_file, grep, shell, etc.) are the dominant token consumer.
 * Truncating them aggressively is the single highest-impact compression lever.
 */
const KEPT_TOOL_OUTPUT_MAX_CHARS = 200;

/**
 * Tools whose functionResponse outputs should be aggressively truncated
 * in the kept history after compression. These are the high-volume tools
 * whose outputs are typically reconstructable from the filesystem.
 */
const HIGH_VOLUME_TOOLS = new Set([
  'read_file',
  'grep_search',
  'glob',
  'run_shell_command',
  'list_directory',
  'web_fetch',
  'edit',
  'write_file',
]);

/**
 * Minimum fraction of history (by character count) that must be compressible
 * to proceed with a compression API call. Prevents futile calls where the
 * model receives almost no context and generates a useless summary.
 */
export const MIN_COMPRESSION_FRACTION = 0.05;

/**
 * Returns the index of the oldest item to keep when compressing. May return
 * contents.length which indicates that everything should be compressed.
 *
 * Exported for testing purposes.
 */
export function findCompressSplitPoint(
  contents: Content[],
  fraction: number,
): number {
  if (fraction <= 0 || fraction >= 1) {
    throw new Error('Fraction must be between 0 and 1');
  }

  const charCounts = contents.map((content) => JSON.stringify(content).length);
  const totalCharCount = charCounts.reduce((a, b) => a + b, 0);
  const targetCharCount = totalCharCount * fraction;

  let lastSplitPoint = 0; // 0 is always valid (compress nothing)
  let cumulativeCharCount = 0;
  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    if (
      content.role === 'user' &&
      !content.parts?.some((part) => !!part.functionResponse)
    ) {
      if (cumulativeCharCount >= targetCharCount) {
        return i;
      }
      lastSplitPoint = i;
    }
    cumulativeCharCount += charCounts[i];
  }

  // We found no split points after targetCharCount.
  // Check if it's safe to compress everything.
  const lastContent = contents[contents.length - 1];
  if (
    lastContent?.role === 'model' &&
    !lastContent?.parts?.some((part) => part.functionCall)
  ) {
    return contents.length;
  }
  // Also safe to compress everything if the last message completes a tool call
  // sequence (all function calls have matching responses).
  if (
    lastContent?.role === 'user' &&
    lastContent?.parts?.some((part) => !!part.functionResponse)
  ) {
    return contents.length;
  }

  return lastSplitPoint;
}

/**
 * Truncate tool output contents in history that is being kept after compression.
 * This targets the #1 cause of poor compression ratios: large tool outputs
 * (file reads, grep results, shell output) surviving in the kept window.
 *
 * For each functionResponse part from a high-volume tool, the output string
 * is truncated to KEPT_TOOL_OUTPUT_MAX_CHARS characters. Error responses
 * are preserved in full since they represent unresolved failures.
 *
 * Non-tool parts (text, inlineData, fileData) are passed through unchanged.
 */
function pruneToolOutputsInHistory(history: Content[]): Content[] {
  return history.map((content) => {
    if (!content.parts || content.parts.length === 0) return content;

    let touched = false;
    const newParts = content.parts.map((part) => {
      if (
        part.functionResponse?.name &&
        HIGH_VOLUME_TOOLS.has(part.functionResponse.name)
      ) {
        const response = part.functionResponse.response;
        // Preserve error responses in full — they indicate unresolved issues
        if (response?.['error']) return part;

        const output = response?.['output'];
        if (typeof output === 'string' && output.length > KEPT_TOOL_OUTPUT_MAX_CHARS) {
          touched = true;
          const truncated =
            output.slice(0, KEPT_TOOL_OUTPUT_MAX_CHARS) +
            '\n... [truncated by compression]';
          return {
            functionResponse: {
              ...part.functionResponse,
              response: { ...response, output: truncated },
            },
          };
        }
      }
      return part;
    });

    return touched ? { ...content, parts: newParts } : content;
  });
}

export class ChatCompressionService {
  async compress(
    chat: GeminiChat,
    promptId: string,
    force: boolean,
    model: string,
    config: Config,
    hasFailedCompressionAttempt: boolean,
    signal?: AbortSignal,
  ): Promise<{ newHistory: Content[] | null; info: ChatCompressionInfo }> {
    const curatedHistory = chat.getHistory(true);
    const threshold =
      config.getChatCompression()?.contextPercentageThreshold ??
      COMPRESSION_TOKEN_THRESHOLD;

    // Regardless of `force`, don't do anything if the history is empty.
    if (
      curatedHistory.length === 0 ||
      threshold <= 0 ||
      (hasFailedCompressionAttempt && !force)
    ) {
      return {
        newHistory: null,
        info: {
          originalTokenCount: 0,
          newTokenCount: 0,
          compressionStatus: CompressionStatus.NOOP,
        },
      };
    }

    const originalTokenCount = uiTelemetryService.getLastPromptTokenCount();

    // Don't compress if not forced and we are under the limit.
    if (!force) {
      const contextLimit =
        config.getContentGeneratorConfig()?.contextWindowSize ??
        DEFAULT_TOKEN_LIMIT;
      if (originalTokenCount < threshold * contextLimit) {
        return {
          newHistory: null,
          info: {
            originalTokenCount,
            newTokenCount: originalTokenCount,
            compressionStatus: CompressionStatus.NOOP,
          },
        };
      }
    }

    // Fire PreCompact hook before compression begins
    const hookSystem = config.getHookSystem();
    if (hookSystem) {
      const trigger = force ? PreCompactTrigger.Manual : PreCompactTrigger.Auto;
      try {
        await hookSystem.firePreCompactEvent(trigger, '', signal);
      } catch (err) {
        config.getDebugLogger().warn(`PreCompact hook failed: ${err}`);
      }
    }

    // For manual /compress (force=true), if the last message is an orphaned model
    // funcCall (agent interrupted/crashed before the response arrived), strip it
    // before computing the split point. After stripping, the history ends cleanly
    // (typically with a user funcResponse) and findCompressSplitPoint handles it
    // through its normal logic — no special-casing needed.
    //
    // auto-compress (force=false) must NOT strip: it fires inside
    // sendMessageStream() before the matching funcResponse is pushed onto the
    // history, so the trailing funcCall is still active, not orphaned.
    const lastMessage = curatedHistory[curatedHistory.length - 1];
    const hasOrphanedFuncCall =
      force &&
      lastMessage?.role === 'model' &&
      lastMessage.parts?.some((p) => !!p.functionCall);
    const historyForSplit = hasOrphanedFuncCall
      ? curatedHistory.slice(0, -1)
      : curatedHistory;

    const preserveThreshold = force
      ? FORCED_COMPRESSION_PRESERVE_THRESHOLD
      : COMPRESSION_PRESERVE_THRESHOLD;
    const splitPoint = findCompressSplitPoint(
      historyForSplit,
      1 - preserveThreshold,
    );

    const historyToCompress = historyForSplit.slice(0, splitPoint);
    const historyToKeep = historyForSplit.slice(splitPoint);

    if (historyToCompress.length === 0) {
      return {
        newHistory: null,
        info: {
          originalTokenCount,
          newTokenCount: originalTokenCount,
          compressionStatus: CompressionStatus.NOOP,
        },
      };
    }

    // Guard: if historyToCompress is too small relative to the total history,
    // skip compression. This prevents futile API calls where the model receives
    // almost no context and generates a useless "summary" that inflates tokens.
    //
    // Note: findCompressSplitPoint already computes charCounts internally but
    // returns only the split index. We intentionally recompute here to keep
    // the function signature simple; this is a minor, acceptable duplication.
    const compressCharCount = historyToCompress.reduce(
      (sum, c) => sum + JSON.stringify(c).length,
      0,
    );
    const totalCharCount = historyForSplit.reduce(
      (sum, c) => sum + JSON.stringify(c).length,
      0,
    );
    if (
      totalCharCount > 0 &&
      compressCharCount / totalCharCount < MIN_COMPRESSION_FRACTION
    ) {
      return {
        newHistory: null,
        info: {
          originalTokenCount,
          newTokenCount: originalTokenCount,
          compressionStatus: CompressionStatus.NOOP,
        },
      };
    }

    // Strip functionCall/functionResponse parts from history before sending
    // to the compression API. The Bedrock Converse API requires a toolConfig
    // when conversation history contains toolUse/toolResult blocks, but
    // compression only needs text content for summarization. Convert tool
    // parts to text summaries so the model still understands what happened.
    const sanitizedHistory = historyToCompress
      .map((content) => {
        const sanitizedParts = (content.parts ?? [])
          .map((part) => {
            if (part.functionCall) {
              const argsStr = JSON.stringify(part.functionCall.args ?? {});
              const truncatedArgs =
                argsStr.length > 150 ? argsStr.slice(0, 150) + '...' : argsStr;
              return {
                text: `[Tool call: ${part.functionCall.name}(${truncatedArgs})]`,
              };
            }
            if (part.functionResponse) {
              const responseStr = JSON.stringify(
                part.functionResponse.response ?? {},
              );
              const truncatedResponse =
                responseStr.length > 200
                  ? responseStr.slice(0, 200) + '...'
                  : responseStr;
              return {
                text: `[Tool result for ${part.functionResponse.name}: ${truncatedResponse}]`,
              };
            }
            return part;
          })
          .filter(
            (part) =>
              'text' in part ||
              'inlineData' in part ||
              'fileData' in part,
          );
        if (sanitizedParts.length === 0) {
          return null;
        }
        return { ...content, parts: sanitizedParts };
      })
      .filter((c) => c !== null) as Content[];

    // After stripping tool parts, consecutive same-role messages may appear
    // (e.g., model message with only functionCall parts removed, followed by
    // another model message). Merge them to maintain valid alternating roles.
    const mergedHistory: Content[] = [];
    for (const entry of sanitizedHistory) {
      const last = mergedHistory[mergedHistory.length - 1];
      if (last && last.role === entry.role) {
        last.parts = [...(last.parts ?? []), ...(entry.parts ?? [])];
      } else {
        mergedHistory.push({ ...entry });
      }
    }

    // Ensure sanitized history is not empty after stripping tool parts
    if (mergedHistory.length === 0) {
      return {
        newHistory: null,
        info: {
          originalTokenCount,
          newTokenCount: originalTokenCount,
          compressionStatus: CompressionStatus.NOOP,
        },
      };
    }

    const summaryResponse = await config.getContentGenerator().generateContent(
      {
        model,
        contents: [
          ...mergedHistory,
          {
            role: 'user',
            parts: [
              {
                text: 'First, reason in your scratchpad. Then, generate the <state_snapshot>.',
              },
            ],
          },
        ],
        config: {
          systemInstruction: getCompressionPrompt(),
          maxOutputTokens: COMPRESSION_MAX_OUTPUT_TOKENS,
        },
      },
      promptId,
    );
    const summary = getResponseText(summaryResponse) ?? '';
    const isSummaryEmpty = !summary || summary.trim().length === 0;
    const compressionUsageMetadata = summaryResponse.usageMetadata;
    const compressionInputTokenCount =
      compressionUsageMetadata?.promptTokenCount;
    let compressionOutputTokenCount =
      compressionUsageMetadata?.candidatesTokenCount;
    if (
      compressionOutputTokenCount === undefined &&
      typeof compressionUsageMetadata?.totalTokenCount === 'number' &&
      typeof compressionInputTokenCount === 'number'
    ) {
      compressionOutputTokenCount = Math.max(
        0,
        compressionUsageMetadata.totalTokenCount - compressionInputTokenCount,
      );
    }

    let newTokenCount = originalTokenCount;
    let extraHistory: Content[] = [];
    let canCalculateNewTokenCount = false;

    if (!isSummaryEmpty) {
      // Aggressively prune tool outputs in the kept history.
      // This is the critical fix: even the 3-5% of kept history can contain
      // massive tool outputs (10k+ token file reads). Truncating them
      // turns a 15% reduction into 80-95% reduction.
      const prunedKeptHistory = pruneToolOutputsInHistory(historyToKeep);

      extraHistory = [
        {
          role: 'user',
          parts: [{ text: summary }],
        },
        {
          role: 'model',
          parts: [{ text: 'Got it. Thanks for the additional context!' }],
        },
        ...prunedKeptHistory,
      ];

      // Best-effort token math using *only* model-reported token counts.
      //
      // Note: compressionInputTokenCount includes the compression prompt and
      // the extra "reason in your scratchpad" instruction(approx. 1000 tokens), and
      // compressionOutputTokenCount may include non-persisted tokens (thoughts).
      // We accept these inaccuracies to avoid local token estimation.
      if (
        typeof compressionInputTokenCount === 'number' &&
        compressionInputTokenCount > 0 &&
        typeof compressionOutputTokenCount === 'number' &&
        compressionOutputTokenCount > 0
      ) {
        canCalculateNewTokenCount = true;
        newTokenCount = Math.max(
          0,
          originalTokenCount -
            (compressionInputTokenCount - 1000) +
            compressionOutputTokenCount,
        );
      }
    }

    logChatCompression(
      config,
      makeChatCompressionEvent({
        tokens_before: originalTokenCount,
        tokens_after: newTokenCount,
        compression_input_token_count: compressionInputTokenCount,
        compression_output_token_count: compressionOutputTokenCount,
      }),
    );

    if (isSummaryEmpty) {
      return {
        newHistory: null,
        info: {
          originalTokenCount,
          newTokenCount: originalTokenCount,
          compressionStatus: CompressionStatus.COMPRESSION_FAILED_EMPTY_SUMMARY,
        },
      };
    } else if (!canCalculateNewTokenCount) {
      return {
        newHistory: null,
        info: {
          originalTokenCount,
          newTokenCount: originalTokenCount,
          compressionStatus:
            CompressionStatus.COMPRESSION_FAILED_TOKEN_COUNT_ERROR,
        },
      };
    } else if (newTokenCount > originalTokenCount) {
      return {
        newHistory: null,
        info: {
          originalTokenCount,
          newTokenCount,
          compressionStatus:
            CompressionStatus.COMPRESSION_FAILED_INFLATED_TOKEN_COUNT,
        },
      };
    } else {
      uiTelemetryService.setLastPromptTokenCount(newTokenCount);

      // Fire SessionStart event after successful compression
      try {
        const permissionMode = String(
          config.getApprovalMode(),
        ) as PermissionMode;
        await config
          .getHookSystem()
          ?.fireSessionStartEvent(
            SessionStartSource.Compact,
            model ?? '',
            permissionMode,
            undefined,
            signal,
          );
      } catch (err) {
        config.getDebugLogger().warn(`SessionStart hook failed: ${err}`);
      }

      // Fire PostCompact event after successful compression
      try {
        const postCompactTrigger = force
          ? PostCompactTrigger.Manual
          : PostCompactTrigger.Auto;
        await config
          .getHookSystem()
          ?.firePostCompactEvent(postCompactTrigger, summary, signal);
      } catch (err) {
        config.getDebugLogger().warn(`PostCompact hook failed: ${err}`);
      }

      return {
        newHistory: extraHistory,
        info: {
          originalTokenCount,
          newTokenCount,
          compressionStatus: CompressionStatus.COMPRESSED,
        },
      };
    }
  }
}
