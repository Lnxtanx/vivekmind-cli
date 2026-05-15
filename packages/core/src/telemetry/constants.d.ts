/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright (C) 2026 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
export declare const SERVICE_NAME = "vivekmind";
export declare const EVENT_USER_PROMPT = "vivekmind.user_prompt";
export declare const EVENT_USER_RETRY = "vivekmind.user_retry";
export declare const EVENT_TOOL_CALL = "vivekmind.tool_call";
export declare const EVENT_API_REQUEST = "vivekmind.api_request";
export declare const EVENT_API_ERROR = "vivekmind.api_error";
export declare const EVENT_API_CANCEL = "vivekmind.api_cancel";
export declare const EVENT_API_RESPONSE = "vivekmind.api_response";
export declare const EVENT_CLI_CONFIG = "vivekmind.config";
export declare const EVENT_EXTENSION_DISABLE = "vivekmind.extension_disable";
export declare const EVENT_EXTENSION_ENABLE = "vivekmind.extension_enable";
export declare const EVENT_EXTENSION_INSTALL = "vivekmind.extension_install";
export declare const EVENT_EXTENSION_UNINSTALL = "vivekmind.extension_uninstall";
export declare const EVENT_EXTENSION_UPDATE = "vivekmind.extension_update";
export declare const EVENT_FLASH_FALLBACK = "vivekmind.flash_fallback";
export declare const EVENT_RIPGREP_FALLBACK = "vivekmind.ripgrep_fallback";
export declare const EVENT_NEXT_SPEAKER_CHECK = "vivekmind.next_speaker_check";
export declare const EVENT_SLASH_COMMAND = "vivekmind.slash_command";
export declare const EVENT_IDE_CONNECTION = "vivekmind.ide_connection";
export declare const EVENT_CHAT_COMPRESSION = "vivekmind.chat_compression";
export declare const EVENT_INVALID_CHUNK = "vivekmind.chat.invalid_chunk";
export declare const EVENT_CONTENT_RETRY = "vivekmind.chat.content_retry";
export declare const EVENT_CONTENT_RETRY_FAILURE = "vivekmind.chat.content_retry_failure";
export declare const EVENT_CONVERSATION_FINISHED = "vivekmind.conversation_finished";
export declare const EVENT_MALFORMED_JSON_RESPONSE = "vivekmind.malformed_json_response";
export declare const EVENT_FILE_OPERATION = "vivekmind.file_operation";
export declare const EVENT_MODEL_SLASH_COMMAND = "vivekmind.slash_command.model";
export declare const EVENT_SUBAGENT_EXECUTION = "vivekmind.subagent_execution";
export declare const EVENT_SKILL_LAUNCH = "vivekmind.skill_launch";
export declare const EVENT_AUTH = "vivekmind.auth";
export declare const EVENT_USER_FEEDBACK = "vivekmind.user_feedback";
export declare const EVENT_PROMPT_SUGGESTION = "vivekmind.prompt_suggestion";
export declare const EVENT_SPECULATION = "vivekmind.speculation";
export declare const EVENT_ARENA_SESSION_STARTED = "vivekmind.arena_session_started";
export declare const EVENT_ARENA_AGENT_COMPLETED = "vivekmind.arena_agent_completed";
export declare const EVENT_ARENA_SESSION_ENDED = "vivekmind.arena_session_ended";
export declare const EVENT_STARTUP_PERFORMANCE = "vivekmind.startup.performance";
export declare const EVENT_MEMORY_USAGE = "vivekmind.memory.usage";
export declare const EVENT_PERFORMANCE_BASELINE = "vivekmind.performance.baseline";
export declare const EVENT_PERFORMANCE_REGRESSION = "vivekmind.performance.regression";
export declare const EVENT_MEMORY_EXTRACT = "vivekmind.memory.extract";
export declare const EVENT_MEMORY_DREAM = "vivekmind.memory.dream";
export declare const EVENT_MEMORY_RECALL = "vivekmind.memory.recall";
