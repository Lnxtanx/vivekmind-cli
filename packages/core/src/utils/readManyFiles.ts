/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Part, PartListUnion } from '@google/genai';
import type { Config } from '../config/config.js';
import { getErrorMessage } from './errors.js';
import { processSingleFileContent } from './fileUtils.js';
import { getFolderStructure } from './getFolderStructure.js';

/**
 * Options for reading multiple files.
 */
export interface ReadManyFilesOptions {
  /**
   * An array of file or directory paths to read.
   * Paths are relative to the project root.
   */
  paths: string[];

  /**
   * Optional AbortSignal for cancellation support.
   */
  signal?: AbortSignal;
}

/**
 * Information about a single file that was read.
 */
export interface FileReadInfo {
  /** Absolute path to the file */
  filePath: string;
  /** Content of the file (string for text, Part for images/PDFs) */
  content: PartListUnion;
  /** Whether this is a directory listing rather than file content */
  isDirectory: boolean;
  /**
   * Error message when the read failed (e.g. missing pdftotext,
   * password-protected PDF, file too large). When present, `content`
   * holds the user-facing guidance string that was surfaced to the LLM,
   * and callers should render this entry as a failed read rather than a
   * successful one.
   */
  error?: string;
}

/**
 * Result from reading multiple files.
 */
export interface ReadManyFilesResult {
  /**
   * Content parts ready for LLM consumption.
   * For text files, content is concatenated with separators.
   * For images/PDFs, includes inline data parts.
   */
  contentParts: PartListUnion;

  /**
   * Individual file results with paths and content.
   * Used for recording each file read as a separate tool result.
   */
  files: FileReadInfo[];

  /**
   * Error message if an error occurred during file search.
   */
  error?: string;
}

const DEFAULT_OUTPUT_HEADER = '\n--- Content from referenced files ---\n';
const DEFAULT_OUTPUT_TERMINATOR = '\n--- End of content ---';

/**
 * Reads content from multiple files and directories specified by paths.
 *
 * For directories, returns the folder structure.
 * For text files, concatenates their content into a single string with separators.
 * For image and PDF files, returns base64-encoded data.
 *
 * @param config - The runtime configuration
 * @param options - Options for file reading (paths, filters, signal)
 * @returns Result containing content parts and processed files
 *
 * NOTE: This utility is invoked only by explicit user-triggered file reads.
 * Do not apply workspace filters or path restrictions here.
 */
export async function readManyFiles(
  config: Config,
  options: ReadManyFilesOptions,
): Promise<ReadManyFilesResult> {
  const { paths: inputPatterns } = options;

  const seenFiles = new Set<string>();
  const contentParts: Part[] = [];
  const files: FileReadInfo[] = [];

  const addContentPart = (part: Part) => {
    if (contentParts.length === 0) {
      contentParts.push({ text: DEFAULT_OUTPUT_HEADER });
    }
    contentParts.push(part);
  };

  try {
    for (const pattern of inputPatterns) {
      if (options.signal?.aborted) {
        break;
      }

      const absolutePath = path.isAbsolute(pattern)
        ? pattern
        : path.resolve(config.getTargetDir(), pattern);

      if (seenFiles.has(absolutePath)) {
        continue;
      }

      try {
        const stats = await fs.promises.stat(absolutePath);

        if (stats.isDirectory()) {
          const folderStructure = await getFolderStructure(absolutePath, {
            maxItems: 40, // Increased from default 20 to give more context for explicit directory reads
          });

          const directoryText = `Directory structure for ${pattern}:\n${folderStructure}`;
          addContentPart({ text: `\n--- Directory: ${pattern} ---\n` });
          addContentPart({ text: directoryText });
          addContentPart({ text: `\n--- End Directory ---\n` });

          files.push({
            filePath: absolutePath,
            content: directoryText,
            isDirectory: true,
          });
          seenFiles.add(absolutePath);
        } else {
          const result = await readFileContent(config, absolutePath);
          if (result) {
            result.contentParts.forEach(addContentPart);
            files.push(result.info);
            seenFiles.add(absolutePath);
          }
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        const errorText = `Failed to access ${pattern}: ${errorMessage}`;
        addContentPart({ text: `\n--- File: ${pattern} ---\n` });
        addContentPart({ text: errorText });
        addContentPart({ text: `\n--- End File ---\n` });

        files.push({
          filePath: absolutePath,
          content: errorText,
          isDirectory: false,
          error: errorMessage,
        });
      }
    }

    if (contentParts.length > 0) {
      contentParts.push({ text: DEFAULT_OUTPUT_TERMINATOR });
    }

    return { contentParts, files };
  } catch (error) {
    return {
      contentParts: [],
      files: [],
      error: getErrorMessage(error),
    };
  }
}

async function readFileContent(
  config: Config,
  filePath: string,
): Promise<{ contentParts: Part[]; info: FileReadInfo } | null> {
  try {
    const fileReadResult = await processSingleFileContent(filePath, config);

    // Surface any error produced by processSingleFileContent instead of
    // silently skipping the file. This preserves actionable guidance
    // (e.g. "pdftotext is not installed, install poppler-utils...",
    // password-protected PDFs, file-too-large) across batch reads.
    if (fileReadResult.error) {
      const errorText =
        typeof fileReadResult.llmContent === 'string'
          ? fileReadResult.llmContent
          : `Failed to read ${filePath}: ${fileReadResult.error}`;
      return {
        contentParts: [
          { text: `\n--- File: ${filePath} ---\n` },
          { text: errorText },
          { text: `\n--- End File ---\n` },
        ],
        info: {
          filePath,
          content: errorText,
          isDirectory: false,
          error: fileReadResult.error,
        },
      };
    }

    if (typeof fileReadResult.llmContent === 'string') {
      let fileContentForLlm = '';
      if (fileReadResult.isTruncated) {
        const [start, end] = fileReadResult.linesShown!;
        const total = fileReadResult.originalLineCount!;
        fileContentForLlm = `Showing lines ${start}-${end} of ${total} total lines.\n---\n${fileReadResult.llmContent}`;
      } else {
        fileContentForLlm = fileReadResult.llmContent;
      }

      const prefixText: Part = { text: `\n--- File: ${filePath} ---\n` };
      const suffixText: Part = { text: `\n--- End File ---\n` };
      const contentParts: Part[] = [
        prefixText,
        { text: fileContentForLlm },
        suffixText,
      ];
      return {
        contentParts,
        info: {
          filePath,
          content: fileContentForLlm,
          isDirectory: false,
        },
      };
    }

    if (fileReadResult.llmContent && typeof fileReadResult.llmContent === 'object') {
      // It's a Part (image/PDF)
      return {
        contentParts: [fileReadResult.llmContent as Part],
        info: {
          filePath,
          content: [fileReadResult.llmContent as Part],
          isDirectory: false,
        },
      };
    }

    return null;
  } catch (error) {
    const errorText = `Error reading ${filePath}: ${getErrorMessage(error)}`;
    return {
      contentParts: [
        { text: `\n--- File: ${filePath} ---\n` },
        { text: errorText },
        { text: `\n--- End File ---\n` },
      ],
      info: {
        filePath,
        content: errorText,
        isDirectory: false,
        error: getErrorMessage(error),
      },
    };
  }
}
