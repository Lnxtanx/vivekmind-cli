/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { ApprovalMode, AuthType, Config, DEFAULT_VIVEKMIND_EMBEDDING_MODEL, FileDiscoveryService, getAllGeminiMdFilenames, loadServerHierarchicalMemory, setGeminiMdFilename as setServerGeminiMdFilename, resolveTelemetrySettings, FatalConfigError, Storage, InputFormat, OutputFormat, SessionService, ideContextStore, ToolNames, NativeLspClient, createDebugLogger, NativeLspService, isBareMode, isToolEnabled, } from '@vivekmind/core';
import { extensionsCommand } from '../commands/extensions.js';
import { hooksCommand } from '../commands/hooks.js';
import { loadSettings, SettingScope } from './settings.js';
import { authCommand } from '../commands/auth.js';
import { resolveCliGenerationConfig, getAuthTypeFromEnv, } from '../utils/modelConfigUtils.js';
import yargs, {} from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import stripJsonComments from 'strip-json-comments';
import { resolvePath } from '../utils/resolvePath.js';
import { getCliVersion } from '../utils/version.js';
import { loadSandboxConfig } from './sandboxConfig.js';
import { appEvents } from '../utils/events.js';
import { mcpCommand } from '../commands/mcp.js';
import { channelCommand } from '../commands/channel.js';
import { reviewCommand } from '../commands/review.js';
// UUID v4 regex pattern for validation
const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(-agent-[a-zA-Z0-9_.-]+)?$/i;
/**
 * Validates if a string is a valid session ID format.
 * Accepts a standard UUID, or a UUID followed by `-agent-{suffix}`
 * (used by Arena to give each agent a deterministic session ID).
 */
export function isValidSessionId(value) {
    return SESSION_ID_REGEX.test(value);
}
import { isWorkspaceTrusted } from './trustedFolders.js';
import { writeStderrLine } from '../utils/stdioHelpers.js';
const debugLogger = createDebugLogger('CONFIG');
const VALID_APPROVAL_MODE_VALUES = [
    'plan',
    'default',
    'auto-edit',
    'yolo',
];
function formatApprovalModeError(value) {
    return new Error(`Invalid approval mode: ${value}. Valid values are: ${VALID_APPROVAL_MODE_VALUES.join(', ')}`);
}
function parseApprovalModeValue(value) {
    const normalized = value.trim().toLowerCase();
    switch (normalized) {
        case 'plan':
            return ApprovalMode.PLAN;
        case 'default':
            return ApprovalMode.DEFAULT;
        case 'yolo':
            return ApprovalMode.YOLO;
        case 'auto_edit':
        case 'autoedit':
        case 'auto-edit':
            return ApprovalMode.AUTO_EDIT;
        default:
            throw formatApprovalModeError(value);
    }
}
function normalizeOutputFormat(format) {
    if (!format) {
        return undefined;
    }
    if (format === OutputFormat.STREAM_JSON) {
        return OutputFormat.STREAM_JSON;
    }
    if (format === 'json' || format === OutputFormat.JSON) {
        return OutputFormat.JSON;
    }
    return OutputFormat.TEXT;
}
export async function parseArguments() {
    let rawArgv = hideBin(process.argv);
    // hack: if the first argument is the CLI entry point, remove it
    if (rawArgv.length > 0 &&
        (rawArgv[0].endsWith('/dist/vivekmind-cli/cli.js') ||
            rawArgv[0].endsWith('/dist/cli.js') ||
            rawArgv[0].endsWith('/dist/cli/cli.js'))) {
        rawArgv = rawArgv.slice(1);
    }
    const yargsInstance = yargs(rawArgv)
        .locale('en')
        .scriptName('vivekmind')
        .usage('Usage: vivekmind [options] [command]\n\nVivekMind - Launch an interactive CLI, use -p/--prompt for non-interactive mode')
        .option('telemetry', {
        type: 'boolean',
        description: 'Enable telemetry? This flag specifically controls if telemetry is sent. Other --telemetry-* flags set specific values but do not enable telemetry on their own.',
    })
        .option('telemetry-target', {
        type: 'string',
        choices: ['local', 'gcp'],
        description: 'Set the telemetry target (local or gcp). Overrides settings files.',
    })
        .option('telemetry-otlp-endpoint', {
        type: 'string',
        description: 'Set the OTLP endpoint for telemetry. Overrides environment variables and settings files.',
    })
        .option('telemetry-otlp-protocol', {
        type: 'string',
        choices: ['grpc', 'http'],
        description: 'Set the OTLP protocol for telemetry (grpc or http). Overrides settings files.',
    })
        .option('telemetry-log-prompts', {
        type: 'boolean',
        description: 'Enable or disable logging of user prompts for telemetry. Overrides settings files.',
    })
        .option('telemetry-outfile', {
        type: 'string',
        description: 'Redirect all telemetry output to the specified file.',
    })
        .deprecateOption('telemetry', 'Use the "telemetry.enabled" setting in settings.json instead. This flag will be removed in a future version.')
        .deprecateOption('telemetry-target', 'Use the "telemetry.target" setting in settings.json instead. This flag will be removed in a future version.')
        .deprecateOption('telemetry-otlp-endpoint', 'Use the "telemetry.otlpEndpoint" setting in settings.json instead. This flag will be removed in a future version.')
        .deprecateOption('telemetry-otlp-protocol', 'Use the "telemetry.otlpProtocol" setting in settings.json instead. This flag will be removed in a future version.')
        .deprecateOption('telemetry-log-prompts', 'Use the "telemetry.logPrompts" setting in settings.json instead. This flag will be removed in a future version.')
        .deprecateOption('telemetry-outfile', 'Use the "telemetry.outfile" setting in settings.json instead. This flag will be removed in a future version.')
        .option('debug', {
        alias: 'd',
        type: 'boolean',
        description: 'Run in debug mode?',
        default: false,
    })
        .option('bare', {
        type: 'boolean',
        description: 'Minimal mode: skip implicit startup auto-discovery and only honor explicitly provided CLI inputs.',
        default: false,
    })
        .option('proxy', {
        type: 'string',
        description: 'Proxy for VivekMind, like schema://user:password@host:port',
    })
        .deprecateOption('proxy', 'Use the "proxy" setting in settings.json instead. This flag will be removed in a future version.')
        .option('chat-recording', {
        type: 'boolean',
        description: 'Enable chat recording to disk. If false, chat history is not saved and --continue/--resume will not work.',
    })
        .command('$0 [query..]', 'Launch VivekMind CLI', (yargsInstance) => yargsInstance
        .positional('query', {
        description: 'Positional prompt. Defaults to one-shot; use -i/--prompt-interactive for interactive.',
    })
        .option('model', {
        alias: 'm',
        type: 'string',
        description: `Model`,
    })
        .option('prompt', {
        alias: 'p',
        type: 'string',
        description: 'Prompt. Appended to input on stdin (if any).',
    })
        .option('prompt-interactive', {
        alias: 'i',
        type: 'string',
        description: 'Execute the provided prompt and continue in interactive mode',
    })
        .option('system-prompt', {
        type: 'string',
        description: 'Override the main session system prompt for this run. Can be combined with --append-system-prompt.',
    })
        .option('append-system-prompt', {
        type: 'string',
        description: 'Append instructions to the main session system prompt for this run. Can be combined with --system-prompt.',
    })
        .option('sandbox', {
        alias: 's',
        type: 'boolean',
        description: 'Run in sandbox?',
    })
        .option('sandbox-image', {
        type: 'string',
        description: 'Sandbox image URI.',
    })
        .option('yolo', {
        alias: 'y',
        type: 'boolean',
        description: 'Automatically accept all actions (aka YOLO mode, see https://www.youtube.com/watch?v=xvFZjo5PgG0 for more details)?',
        default: false,
    })
        .option('approval-mode', {
        type: 'string',
        choices: ['plan', 'default', 'auto-edit', 'yolo'],
        description: 'Set the approval mode: plan (plan only), default (prompt for approval), auto-edit (auto-approve edit tools), yolo (auto-approve all tools)',
    })
        .option('checkpointing', {
        type: 'boolean',
        description: 'Enables checkpointing of file edits',
        default: false,
    })
        .option('acp', {
        type: 'boolean',
        description: 'Starts the agent in ACP mode',
    })
        .option('experimental-acp', {
        type: 'boolean',
        description: 'Starts the agent in ACP mode (deprecated, use --acp instead)',
        hidden: true,
    })
        .option('experimental-skills', {
        type: 'boolean',
        description: 'Deprecated: Skills are now enabled by default. This flag is ignored.',
        hidden: true,
    })
        .option('experimental-lsp', {
        type: 'boolean',
        description: 'Enable experimental LSP (Language Server Protocol) feature for code intelligence',
        default: false,
    })
        .option('channel', {
        type: 'string',
        choices: ['VSCode', 'ACP', 'SDK', 'CI'],
        description: 'Channel identifier (VSCode, ACP, SDK, CI)',
    })
        .option('allowed-mcp-server-names', {
        type: 'array',
        string: true,
        description: 'Allowed MCP server names',
        coerce: (mcpServerNames) => 
        // Handle comma-separated values
        mcpServerNames.flatMap((mcpServerName) => mcpServerName.split(',').map((m) => m.trim())),
    })
        .option('mcp-config', {
        type: 'string',
        description: 'MCP server configuration as JSON string or file path. Can be a path to a JSON file or inline JSON with {"mcpServers": {...}} format.',
    })
        .option('allowed-tools', {
        type: 'array',
        string: true,
        description: 'Tools that are allowed to run without confirmation',
        coerce: (tools) => 
        // Handle comma-separated values
        tools.flatMap((tool) => tool.split(',').map((t) => t.trim())),
    })
        .option('extensions', {
        alias: 'e',
        type: 'array',
        string: true,
        description: 'A list of extensions to use. If not provided, all extensions are used.',
        coerce: (extensions) => 
        // Handle comma-separated values
        extensions.flatMap((extension) => extension.split(',').map((e) => e.trim())),
    })
        .option('list-extensions', {
        alias: 'l',
        type: 'boolean',
        description: 'List all available extensions and exit.',
    })
        .option('include-directories', {
        alias: 'add-dir',
        type: 'array',
        string: true,
        description: 'Additional directories to include in the workspace (comma-separated or multiple --include-directories)',
        coerce: (dirs) => 
        // Handle comma-separated values
        dirs.flatMap((dir) => dir.split(',').map((d) => d.trim())),
    })
        .option('openai-logging', {
        type: 'boolean',
        description: 'Enable logging of OpenAI API calls for debugging and analysis',
    })
        .option('openai-logging-dir', {
        type: 'string',
        description: 'Custom directory path for OpenAI API logs. Overrides settings files.',
    })
        .option('openai-api-key', {
        type: 'string',
        description: 'OpenAI API key to use for authentication',
    })
        .option('openai-base-url', {
        type: 'string',
        description: 'OpenAI base URL (for custom endpoints)',
    })
        .option('screen-reader', {
        type: 'boolean',
        description: 'Enable screen reader mode for accessibility.',
    })
        .option('input-format', {
        type: 'string',
        choices: ['text', 'stream-json'],
        description: 'The format consumed from standard input.',
        default: 'text',
    })
        .option('output-format', {
        alias: 'o',
        type: 'string',
        description: 'The format of the CLI output.',
        choices: ['text', 'json', 'stream-json'],
    })
        .option('include-partial-messages', {
        type: 'boolean',
        description: 'Include partial assistant messages when using stream-json output.',
        default: false,
    })
        .option('json-fd', {
        type: 'number',
        description: 'File descriptor for structured JSON event output (dual output mode). ' +
            'The TUI renders normally on stdout while JSON events are written to this fd. ' +
            'The caller must provide this fd via spawn stdio configuration.',
    })
        .option('json-file', {
        type: 'string',
        description: 'File path for structured JSON event output (dual output mode). ' +
            'Can be a regular file, FIFO (named pipe), or /dev/fd/N.',
    })
        .option('input-file', {
        type: 'string',
        description: 'File path for receiving remote input commands (bidirectional sync). ' +
            'An external process writes JSONL commands; the TUI watches and processes them.',
    })
        .option('continue', {
        alias: 'c',
        type: 'boolean',
        description: 'Resume the most recent session for the current project.',
        default: false,
    })
        .option('resume', {
        alias: 'r',
        type: 'string',
        description: 'Resume a specific session by its ID. Use without an ID to show session picker.',
    })
        .option('session-id', {
        type: 'string',
        description: 'Specify a session ID for this run.',
    })
        .option('max-session-turns', {
        type: 'number',
        description: 'Maximum number of session turns',
    })
        .option('core-tools', {
        type: 'array',
        string: true,
        description: 'Core tool paths',
        coerce: (tools) => tools.flatMap((tool) => tool.split(',').map((t) => t.trim())),
    })
        .option('exclude-tools', {
        type: 'array',
        string: true,
        description: 'Tools to exclude',
        coerce: (tools) => tools.flatMap((tool) => tool.split(',').map((t) => t.trim())),
    })
        .option('disabled-slash-commands', {
        type: 'array',
        string: true,
        description: 'Slash command names to hide/disable (comma-separated or ' +
            'repeated). Merged with the `slashCommands.disabled` setting ' +
            'and VIVEKMIND_DISABLED_SLASH_COMMANDS. Matched case-insensitively ' +
            'against the final command name.',
        coerce: (names) => names.flatMap((n) => n.split(',').map((t) => t.trim())),
    })
        .option('allowed-tools', {
        type: 'array',
        string: true,
        description: 'Tools to allow, will bypass confirmation',
        coerce: (tools) => tools.flatMap((tool) => tool.split(',').map((t) => t.trim())),
    })
        .option('auth-type', {
        type: 'string',
        choices: [
            AuthType.USE_OPENAI,
            AuthType.USE_ANTHROPIC,
            AuthType.VIVEKMIND_OAUTH,
            AuthType.USE_GEMINI,
            AuthType.USE_VERTEX_AI,
        ],
        description: 'Authentication type',
    })
        .deprecateOption('sandbox-image', 'Use the "tools.sandboxImage" setting in settings.json instead. This flag will be removed in a future version.')
        .deprecateOption('checkpointing', 'Use the "general.checkpointing.enabled" setting in settings.json instead. This flag will be removed in a future version.')
        .deprecateOption('prompt', 'Use the positional prompt instead. This flag will be removed in a future version.')
        // Ensure validation flows through .fail() for clean UX
        .fail((msg, err, yargs) => {
        writeStderrLine(msg || err?.message || 'Unknown error');
        yargs.showHelp();
        process.exit(1);
    })
        .check((argv) => {
        // The 'query' positional can be a string (for one arg) or string[] (for multiple).
        // This guard safely checks if any positional argument was provided.
        const query = argv['query'];
        const hasPositionalQuery = Array.isArray(query)
            ? query.length > 0
            : !!query;
        if (argv['prompt'] && hasPositionalQuery) {
            return 'Cannot use both a positional prompt and the --prompt (-p) flag together';
        }
        if (argv['prompt'] && argv['promptInteractive']) {
            return 'Cannot use both --prompt (-p) and --prompt-interactive (-i) together';
        }
        if (argv['yolo'] && argv['approvalMode']) {
            return 'Cannot use both --yolo (-y) and --approval-mode together. Use --approval-mode=yolo instead.';
        }
        if (argv['includePartialMessages'] &&
            argv['outputFormat'] !== OutputFormat.STREAM_JSON) {
            return '--include-partial-messages requires --output-format stream-json';
        }
        if (argv['inputFormat'] === 'stream-json' &&
            argv['outputFormat'] !== OutputFormat.STREAM_JSON) {
            return '--input-format stream-json requires --output-format stream-json';
        }
        if (argv['continue'] && argv['resume']) {
            return 'Cannot use both --continue and --resume together. Use --continue to resume the latest session, or --resume <sessionId> to resume a specific session.';
        }
        if (argv['sessionId'] && (argv['continue'] || argv['resume'])) {
            return 'Cannot use --session-id with --continue or --resume. Use --session-id to start a new session with a specific ID, or use --continue/--resume to resume an existing session.';
        }
        if (argv['sessionId'] &&
            !isValidSessionId(argv['sessionId'])) {
            return `Invalid --session-id: "${argv['sessionId']}". Must be a valid UUID (e.g., "123e4567-e89b-12d3-a456-426614174000").`;
        }
        // --resume accepts either a session UUID or a custom title
        if (argv['jsonFd'] != null && argv['jsonFile'] != null) {
            return '--json-fd and --json-file are mutually exclusive. Use one or the other.';
        }
        return true;
    }))
        // Register MCP subcommands
        .command(mcpCommand)
        // Register Extension subcommands
        .command(extensionsCommand)
        // Register Auth subcommands
        .command(authCommand)
        // Register Hooks subcommands
        .command(hooksCommand)
        // Register Channel subcommands
        .command(channelCommand)
        // Register /review skill helpers (presubmit checks, cleanup)
        .command(reviewCommand);
    yargsInstance
        .version(await getCliVersion()) // This will enable the --version flag based on package.json
        .alias('v', 'version')
        .help()
        .alias('h', 'help')
        .strict()
        .demandCommand(0, 0); // Allow base command to run with no subcommands
    yargsInstance.wrap(yargsInstance.terminalWidth());
    const result = await yargsInstance.parse();
    // If yargs handled --help/--version it will have exited; nothing to do here.
    // Handle case where MCP subcommands are executed - they should exit the process
    // and not return to main CLI logic
    if (result._.length > 0 &&
        (result._[0] === 'mcp' ||
            result._[0] === 'extensions' ||
            result._[0] === 'hooks' ||
            result._[0] === 'channel' ||
            result._[0] === 'review')) {
        // MCP/Extensions/Hooks/Channel/Review commands handle their own
        // execution and exit. Returning here would let the main interactive
        // flow run, which would prompt for stdin input despite the user
        // having already invoked a subcommand.
        process.exit(0);
    }
    // Normalize query args: handle both quoted "@path file" and unquoted @path file
    const queryArg = result.query;
    const q = Array.isArray(queryArg)
        ? queryArg.join(' ')
        : queryArg;
    // Route positional args: explicit -i flag -> interactive; else -> one-shot (even for @commands)
    if (q && !result['prompt']) {
        const hasExplicitInteractive = result['promptInteractive'] === '' || !!result['promptInteractive'];
        if (hasExplicitInteractive) {
            result['promptInteractive'] = q;
        }
        else {
            result['prompt'] = q;
        }
    }
    // Keep CliArgs.query as a string for downstream typing
    result['query'] = q || undefined;
    // The import format is now only controlled by settings.memoryImportFormat
    // We no longer accept it as a CLI argument
    // Handle deprecated --experimental-acp flag
    if (result['experimentalAcp']) {
        writeStderrLine('\x1b[33m⚠ Warning: --experimental-acp is deprecated and will be removed in a future release. Please use --acp instead.\x1b[0m');
        // Map experimental-acp to acp if acp is not explicitly set
        if (!result['acp']) {
            result['acp'] = true;
        }
    }
    // Apply ACP fallback: if acp or experimental-acp is present but no explicit --channel, treat as ACP
    if ((result['acp'] || result['experimentalAcp']) && !result['channel']) {
        result['channel'] = 'ACP';
    }
    return result;
}
// This function is now a thin wrapper around the server's implementation.
// It's kept in the CLI for now as App.tsx directly calls it for memory refresh.
// TODO: Consider if App.tsx should get memory via a server call or if Config should refresh itself.
export async function loadHierarchicalGeminiMemory(currentWorkingDirectory, includeDirectoriesToReadGemini = [], fileService, extensionContextFilePaths = [], folderTrust, memoryImportFormat = 'tree', contextRuleExcludes = []) {
    // FIX: Use real, canonical paths for a reliable comparison to handle symlinks.
    const realCwd = fs.realpathSync(path.resolve(currentWorkingDirectory));
    const realHome = fs.realpathSync(path.resolve(homedir()));
    const isHomeDirectory = realCwd === realHome;
    // If it is the home directory, pass an empty string to the core memory
    // function to signal that it should skip the workspace search.
    const effectiveCwd = isHomeDirectory ? '' : currentWorkingDirectory;
    // Directly call the server function with the corrected path.
    return loadServerHierarchicalMemory(effectiveCwd, includeDirectoriesToReadGemini, fileService, extensionContextFilePaths, folderTrust, memoryImportFormat, contextRuleExcludes);
}
export function isDebugMode(argv) {
    return (argv.debug ||
        [process.env['DEBUG'], process.env['DEBUG_MODE']].some((v) => v === 'true' || v === '1'));
}
/**
 * Validates that the provided config is a valid MCP server configuration object.
 */
function validateMcpServerConfig(config) {
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
        return false;
    }
    // Basic validation - each entry should be an object
    return Object.values(config).every((server) => typeof server === 'object' && server !== null);
}
/**
 * Parses MCP configuration from command-line argument.
 * Supports both file paths and inline JSON strings.
 * Handles both {"mcpServers": {...}} and direct {...} formats.
 *
 * @param mcpConfigArg - The --mcp-config value (file path or JSON string)
 * @returns Record of MCP server configurations, or null if no config provided
 * @throws FatalConfigError if the configuration is invalid
 */
function parseMcpConfig(mcpConfigArg) {
    if (!mcpConfigArg) {
        return null;
    }
    try {
        let parsed;
        // Check if it's a file path
        if (fs.existsSync(mcpConfigArg)) {
            debugLogger.debug(`Reading MCP config from file: ${mcpConfigArg}`);
            const content = fs.readFileSync(mcpConfigArg, 'utf-8');
            parsed = JSON.parse(stripJsonComments(content));
        }
        else {
            // Try parsing as JSON string
            debugLogger.debug('Parsing MCP config as JSON string');
            parsed = JSON.parse(mcpConfigArg);
        }
        // Handle both {"mcpServers": {...}} and direct {...} formats
        let servers;
        if (typeof parsed === 'object' &&
            parsed !== null &&
            'mcpServers' in parsed &&
            typeof parsed.mcpServers === 'object') {
            servers = parsed.mcpServers;
        }
        else {
            servers = parsed;
        }
        // Validate the structure
        if (!validateMcpServerConfig(servers)) {
            throw new Error('Invalid MCP server configuration format. Expected an object with server names as keys.');
        }
        debugLogger.debug(`Loaded ${Object.keys(servers).length} MCP server(s) from --mcp-config`);
        return servers;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new FatalConfigError(`Invalid MCP configuration provided via --mcp-config: ${errorMessage}`);
    }
}
export async function loadCliConfig(settings, argv, cwd = process.cwd(), overrideExtensions, 
/**
 * Optional separated hooks for proper source attribution.
 * If provided, these override settings.hooks for hook loading.
 */
hooksConfig) {
    const debugMode = isDebugMode(argv);
    const bareMode = isBareMode(argv.bare);
    // Set runtime output directory from settings (env var VIVEKMIND_RUNTIME_DIR
    // is auto-detected inside getRuntimeBaseDir() at each call site).
    // Pass cwd so that relative paths like ".vivekmind" resolve per-project.
    Storage.setRuntimeBaseDir(settings.advanced?.runtimeOutputDir, cwd);
    const ideMode = settings.ide?.enabled ?? false;
    const folderTrust = settings.security?.folderTrust?.enabled ?? false;
    const trustedFolder = isWorkspaceTrusted(settings)?.isTrusted ?? true;
    // Set the context filename in the server's memoryTool module BEFORE loading memory
    // TODO(b/343434939): This is a bit of a hack. The contextFileName should ideally be passed
    // directly to the Config constructor in core, and have core handle setGeminiMdFilename.
    // However, loadHierarchicalGeminiMemory is called *before* createServerConfig.
    if (settings.context?.fileName) {
        setServerGeminiMdFilename(settings.context.fileName);
    }
    else {
        // Reset to default context filenames if not provided in settings.
        setServerGeminiMdFilename(getAllGeminiMdFilenames());
    }
    // Automatically load output-language.md if it exists
    const projectStorage = new Storage(cwd);
    const projectOutputLanguagePath = path.join(projectStorage.getVivekMindDir(), 'output-language.md');
    const globalOutputLanguagePath = path.join(Storage.getGlobalVivekMindDir(), 'output-language.md');
    let outputLanguageFilePath;
    if (!bareMode) {
        if (fs.existsSync(projectOutputLanguagePath)) {
            outputLanguageFilePath = projectOutputLanguagePath;
        }
        else if (fs.existsSync(globalOutputLanguagePath)) {
            outputLanguageFilePath = globalOutputLanguagePath;
        }
    }
    const fileService = new FileDiscoveryService(cwd);
    const includeDirectories = (bareMode ? [] : (settings.context?.includeDirectories ?? []))
        .map(resolvePath)
        .concat((argv.includeDirectories || []).map(resolvePath));
    // LSP configuration: enabled only via --experimental-lsp flag
    const lspEnabled = !bareMode && argv.experimentalLsp === true;
    let lspClient;
    const question = argv.promptInteractive || argv.prompt || '';
    const inputFormat = argv.inputFormat ?? InputFormat.TEXT;
    const argvOutputFormat = normalizeOutputFormat(argv.outputFormat);
    const settingsOutputFormat = normalizeOutputFormat(settings.output?.format);
    const outputFormat = argvOutputFormat ?? settingsOutputFormat ?? OutputFormat.TEXT;
    const outputSettingsFormat = outputFormat === OutputFormat.STREAM_JSON
        ? settingsOutputFormat &&
            settingsOutputFormat !== OutputFormat.STREAM_JSON
            ? settingsOutputFormat
            : OutputFormat.TEXT
        : outputFormat;
    const includePartialMessages = Boolean(argv.includePartialMessages);
    // Determine approval mode with backward compatibility
    let approvalMode;
    if (argv.approvalMode) {
        approvalMode = parseApprovalModeValue(argv.approvalMode);
    }
    else if (argv.yolo) {
        approvalMode = ApprovalMode.YOLO;
    }
    else if (!bareMode && settings.tools?.approvalMode) {
        approvalMode = parseApprovalModeValue(settings.tools.approvalMode);
    }
    else {
        approvalMode = ApprovalMode.DEFAULT;
    }
    // Force approval mode to default if the folder is not trusted.
    if (!trustedFolder &&
        approvalMode !== ApprovalMode.DEFAULT &&
        approvalMode !== ApprovalMode.PLAN) {
        writeStderrLine(`Approval mode overridden to "default" because the current folder is not trusted.`);
        approvalMode = ApprovalMode.DEFAULT;
    }
    let telemetrySettings;
    try {
        telemetrySettings = await resolveTelemetrySettings({
            argv,
            env: process.env,
            settings: settings.telemetry,
        });
    }
    catch (err) {
        if (err instanceof FatalConfigError) {
            throw new FatalConfigError(`Invalid telemetry configuration: ${err.message}.`);
        }
        throw err;
    }
    // Interactive mode determination with priority:
    // 1. If promptInteractive (-i flag) is provided, it is explicitly interactive
    // 2. If outputFormat is stream-json or json (no matter input-format) along with query or prompt, it is non-interactive
    // 3. If no query or prompt is provided, check isTTY: TTY means interactive, non-TTY means non-interactive
    const hasQuery = !!argv.query;
    const hasPrompt = !!argv.prompt;
    let interactive;
    if (argv.promptInteractive) {
        // Priority 1: Explicit -i flag means interactive
        interactive = true;
    }
    else if ((outputFormat === OutputFormat.STREAM_JSON ||
        outputFormat === OutputFormat.JSON) &&
        (hasQuery || hasPrompt)) {
        // Priority 2: JSON/stream-json output with query/prompt means non-interactive
        interactive = false;
    }
    else if (!hasQuery && !hasPrompt) {
        // Priority 3: No query or prompt means interactive only if TTY (format arguments ignored)
        interactive = process.stdin.isTTY ?? false;
    }
    else {
        // Default: If we have query/prompt but output format is TEXT, assume non-interactive
        // (fallback for edge cases where query/prompt is provided with TEXT output)
        interactive = false;
    }
    // ── Unified permissions construction ─────────────────────────────────────
    // All permission sources are merged here, before constructing Config.
    // The resulting three arrays are the single source of truth that Config /
    // PermissionManager will use.
    //
    // Sources (in order of precedence within each list):
    //   1. settings.permissions.{allow,ask,deny}  (persistent, merged by LoadedSettings)
    //   2. argv.coreTools   → allow  (allowlist mode: only these tools are available)
    //   3. argv.allowedTools → allow  (auto-approve these tools/commands)
    //   4. argv.excludeTools → deny   (block these tools completely)
    //   5. Non-interactive mode exclusions → deny (unless explicitly allowed above)
    // Start from settings-level rules.
    // Read from both new `permissions` and legacy `tools` paths for compatibility.
    // Note: settings.tools.core / argv.coreTools are intentionally NOT merged into
    // mergedAllow — they have whitelist semantics (only listed tools are registered),
    // not auto-approve semantics. They are passed via the `coreTools` Config param
    // and handled by PermissionManager.coreToolsAllowList.
    const resolvedCoreTools = [
        ...(bareMode ? [] : (argv.coreTools ?? [])),
        ...(bareMode ? [] : (settings.tools?.core ?? [])),
    ];
    const mergedAllow = [
        ...(bareMode ? [] : (settings.permissions?.allow ?? [])),
        ...(bareMode ? [] : (settings.tools?.allowed ?? [])),
    ];
    const mergedAsk = [
        ...(bareMode ? [] : (settings.permissions?.ask ?? [])),
    ];
    const mergedDeny = [
        ...(bareMode ? [] : (settings.permissions?.deny ?? [])),
        ...(bareMode ? [] : (settings.tools?.exclude ?? [])),
    ];
    // argv.allowedTools adds allow rules (auto-approve).
    for (const t of argv.allowedTools ?? []) {
        if (t && !mergedAllow.includes(t))
            mergedAllow.push(t);
    }
    // argv.excludeTools adds deny rules.
    for (const t of argv.excludeTools ?? []) {
        if (t && !mergedDeny.includes(t))
            mergedDeny.push(t);
    }
    // Merge the slash-command denylist from settings + CLI flag + env var.
    // Settings merge (UNION across scopes) is already handled upstream; we
    // only de-duplicate while preserving case for diagnostic purposes.
    const disabledSlashCommands = [];
    const seenDisabled = new Set();
    const addDisabled = (value) => {
        if (!value)
            return;
        const trimmed = value.trim();
        if (!trimmed)
            return;
        const key = trimmed.toLowerCase();
        if (!seenDisabled.has(key)) {
            seenDisabled.add(key);
            disabledSlashCommands.push(trimmed);
        }
    };
    for (const name of settings.slashCommands?.disabled ?? [])
        addDisabled(name);
    for (const name of argv.disabledSlashCommands ?? [])
        addDisabled(name);
    for (const name of (process.env['VIVEKMIND_DISABLED_SLASH_COMMANDS'] ?? '').split(',')) {
        addDisabled(name);
    }
    // Helper: check if a tool is explicitly covered by an allow rule OR by the
    // coreTools whitelist. Uses alias matching for coreTools (via isToolEnabled)
    // to preserve the original behaviour where "ShellTool", "Shell", and
    // "run_shell_command" are all accepted as the same tool.
    const isExplicitlyAllowed = (toolName) => {
        // 1. Check permissions.allow / allowedTools rules.
        if (mergedAllow.some((rule) => isToolEnabled(toolName, [rule], []))) {
            return true;
        }
        // 2. Check coreTools whitelist (with alias matching).
        // If coreTools is non-empty and explicitly includes this tool, it is
        // considered allowed for non-interactive mode exclusion purposes.
        if (resolvedCoreTools.length > 0) {
            return isToolEnabled(toolName, resolvedCoreTools, []);
        }
        return false;
    };
    // In non-interactive mode, tools that require a user prompt are denied unless
    // the caller has explicitly allowed them. Stream-JSON input is excluded from
    // this logic because approval can be sent programmatically via JSON messages.
    const isAcpMode = argv.acp || argv.experimentalAcp;
    if (!bareMode &&
        !interactive &&
        !isAcpMode &&
        inputFormat !== InputFormat.STREAM_JSON) {
        const denyUnlessAllowed = (toolName) => {
            if (!isExplicitlyAllowed(toolName)) {
                const name = toolName;
                if (!mergedDeny.includes(name))
                    mergedDeny.push(name);
            }
        };
        switch (approvalMode) {
            case ApprovalMode.PLAN:
            case ApprovalMode.DEFAULT:
                // Deny all write/execute tools unless explicitly allowed.
                denyUnlessAllowed(ToolNames.SHELL);
                denyUnlessAllowed(ToolNames.MONITOR);
                denyUnlessAllowed(ToolNames.EDIT);
                denyUnlessAllowed(ToolNames.WRITE_FILE);
                break;
            case ApprovalMode.AUTO_EDIT:
                // Shell-like execute tools still require a prompt in auto-edit mode.
                denyUnlessAllowed(ToolNames.SHELL);
                denyUnlessAllowed(ToolNames.MONITOR);
                break;
            case ApprovalMode.YOLO:
                // No extra denials for YOLO mode.
                break;
            default:
                break;
        }
    }
    let allowedMcpServers;
    let excludedMcpServers;
    if (argv.allowedMcpServerNames) {
        allowedMcpServers = new Set(argv.allowedMcpServerNames.filter(Boolean));
        excludedMcpServers = undefined;
    }
    else if (!bareMode) {
        allowedMcpServers = settings.mcp?.allowed
            ? new Set(settings.mcp.allowed.filter(Boolean))
            : undefined;
        excludedMcpServers = settings.mcp?.excluded
            ? new Set(settings.mcp.excluded.filter(Boolean))
            : undefined;
    }
    const selectedAuthType = argv.authType ||
        (bareMode ? undefined : settings.security?.auth?.selectedType) ||
        /* getAuthTypeFromEnv means no authType was explicitly provided, we infer the authType from env vars */
        getAuthTypeFromEnv();
    // Unified resolution of generation config with source attribution
    const resolvedCliConfig = resolveCliGenerationConfig({
        argv: {
            model: argv.model,
            openaiApiKey: argv.openaiApiKey,
            openaiBaseUrl: argv.openaiBaseUrl,
            openaiLogging: argv.openaiLogging,
            openaiLoggingDir: argv.openaiLoggingDir,
        },
        settings,
        selectedAuthType,
        env: process.env,
    });
    const { model: resolvedModel } = resolvedCliConfig;
    const sandboxConfig = await loadSandboxConfig(bareMode ? {} : settings, argv);
    const screenReader = argv.screenReader !== undefined
        ? argv.screenReader
        : (settings.ui?.accessibility?.screenReader ?? false);
    let sessionId;
    let sessionData;
    if (argv.continue || argv.resume) {
        const sessionService = new SessionService(cwd);
        if (argv.continue) {
            sessionData = await sessionService.loadLastSession();
            if (sessionData) {
                sessionId = sessionData.conversation.sessionId;
            }
        }
        if (argv.resume) {
            // By the time we get here, argv.resume has been resolved to a valid
            // session UUID by gemini.tsx (which handles custom title lookup and
            // the interactive picker for ambiguous matches).
            sessionId = argv.resume;
            sessionData = await sessionService.loadSession(argv.resume);
            if (!sessionData) {
                const message = `No saved session found with ID ${argv.resume}. Run \`vivekmind --resume\` without an ID to choose from existing sessions.`;
                writeStderrLine(message);
                process.exit(1);
            }
        }
    }
    else if (argv['sessionId']) {
        // Use provided session ID without session resumption
        // Check if session ID is already in use
        const sessionService = new SessionService(cwd);
        const exists = await sessionService.sessionExists(argv['sessionId']);
        if (exists) {
            const message = `Error: Session Id ${argv['sessionId']} is already in use.`;
            writeStderrLine(message);
            process.exit(1);
        }
        sessionId = argv['sessionId'];
    }
    const modelProvidersConfig = settings.modelProviders;
    const config = new Config({
        sessionId,
        sessionData,
        embeddingModel: DEFAULT_VIVEKMIND_EMBEDDING_MODEL,
        sandbox: sandboxConfig,
        targetDir: cwd,
        includeDirectories,
        loadMemoryFromIncludeDirectories: bareMode
            ? includeDirectories.length > 0
            : (settings.context?.loadFromIncludeDirectories ?? false),
        importFormat: settings.context?.importFormat || 'tree',
        debugMode,
        question,
        systemPrompt: argv.systemPrompt,
        appendSystemPrompt: argv.appendSystemPrompt,
        // Legacy fields – kept for backward compatibility with getCoreTools() etc.
        coreTools: bareMode
            ? undefined
            : argv.coreTools || settings.tools?.core || undefined,
        allowedTools: bareMode
            ? argv.allowedTools || undefined
            : argv.allowedTools || settings.tools?.allowed || undefined,
        excludeTools: mergedDeny,
        disabledSlashCommands: disabledSlashCommands.length > 0 ? disabledSlashCommands : undefined,
        // New unified permissions (PermissionManager source of truth).
        permissions: {
            allow: mergedAllow.length > 0 ? mergedAllow : undefined,
            ask: mergedAsk.length > 0 ? mergedAsk : undefined,
            deny: mergedDeny.length > 0 ? mergedDeny : undefined,
        },
        // Permission rule persistence callback (writes to settings files).
        onPersistPermissionRule: async (scope, ruleType, rule) => {
            const currentSettings = loadSettings(cwd);
            const settingScope = scope === 'project' ? SettingScope.Workspace : SettingScope.User;
            const key = `permissions.${ruleType}`;
            const currentRules = currentSettings.forScope(settingScope).settings.permissions?.[ruleType] ?? [];
            if (!currentRules.includes(rule)) {
                currentSettings.setValue(settingScope, key, [...currentRules, rule]);
            }
        },
        toolDiscoveryCommand: bareMode
            ? undefined
            : settings.tools?.discoveryCommand,
        toolCallCommand: bareMode ? undefined : settings.tools?.callCommand,
        mcpServerCommand: bareMode ? undefined : settings.mcp?.serverCommand,
        mcpServers: bareMode
            ? {}
            : (() => {
                const base = settings.mcpServers || {};
                const cliMcpServers = parseMcpConfig(argv.mcpConfig);
                return cliMcpServers ? { ...base, ...cliMcpServers } : base;
            })(),
        allowedMcpServers: allowedMcpServers
            ? Array.from(allowedMcpServers)
            : undefined,
        excludedMcpServers: excludedMcpServers
            ? Array.from(excludedMcpServers)
            : undefined,
        approvalMode,
        accessibility: {
            ...settings.ui?.accessibility,
            screenReader,
        },
        telemetry: telemetrySettings,
        usageStatisticsEnabled: settings.privacy?.usageStatisticsEnabled ?? true,
        clearContextOnIdle: settings.context?.clearContextOnIdle,
        fileFiltering: settings.context?.fileFiltering,
        checkpointing: argv.checkpointing || settings.general?.checkpointing?.enabled,
        proxy: argv.proxy ||
            settings.proxy ||
            process.env['HTTPS_PROXY'] ||
            process.env['https_proxy'] ||
            process.env['HTTP_PROXY'] ||
            process.env['http_proxy'],
        cwd,
        fileDiscoveryService: fileService,
        bugCommand: settings.advanced?.bugCommand,
        model: resolvedModel,
        outputLanguageFilePath,
        sessionTokenLimit: settings.model?.sessionTokenLimit ?? -1,
        maxSessionTurns: argv.maxSessionTurns ?? settings.model?.maxSessionTurns ?? -1,
        experimentalZedIntegration: argv.acp || argv.experimentalAcp || false,
        cronEnabled: settings.experimental?.cron ?? false,
        emitToolUseSummaries: settings.experimental?.emitToolUseSummaries ?? true,
        listExtensions: argv.listExtensions || false,
        overrideExtensions: overrideExtensions || argv.extensions,
        noBrowser: !!process.env['NO_BROWSER'],
        authType: selectedAuthType,
        inputFormat,
        outputFormat,
        includePartialMessages,
        modelProvidersConfig,
        generationConfigSources: resolvedCliConfig.sources,
        generationConfig: resolvedCliConfig.generationConfig,
        warnings: resolvedCliConfig.warnings,
        bareMode,
        allowedHttpHookUrls: bareMode
            ? []
            : (settings.security?.allowedHttpHookUrls ?? []),
        cliVersion: await getCliVersion(),
        ideMode,
        chatCompression: settings.model?.chatCompression,
        folderTrust,
        interactive,
        trustedFolder,
        useRipgrep: settings.tools?.useRipgrep,
        useBuiltinRipgrep: settings.tools?.useBuiltinRipgrep,
        shouldUseNodePtyShell: settings.tools?.shell?.enableInteractiveShell,
        skipNextSpeakerCheck: settings.model?.skipNextSpeakerCheck,
        skipLoopDetection: settings.model?.skipLoopDetection ?? true,
        skipStartupContext: settings.model?.skipStartupContext ?? false,
        truncateToolOutputThreshold: settings.tools?.truncateToolOutputThreshold,
        truncateToolOutputLines: settings.tools?.truncateToolOutputLines,
        eventEmitter: appEvents,
        gitCoAuthor: settings.general?.gitCoAuthor,
        output: {
            format: outputSettingsFormat,
        },
        enableManagedAutoMemory: bareMode
            ? false
            : (settings.memory?.enableManagedAutoMemory ?? true),
        enableManagedAutoDream: settings.memory?.enableManagedAutoDream ?? false,
        fastModel: settings.fastModel || undefined,
        // Use separated hooks if provided, otherwise fall back to merged hooks
        userHooks: bareMode
            ? undefined
            : (hooksConfig?.userHooks ?? settings.hooks),
        projectHooks: bareMode ? undefined : hooksConfig?.projectHooks,
        hooks: bareMode ? undefined : settings.hooks, // Keep for backward compatibility
        disableAllHooks: bareMode ? true : (settings.disableAllHooks ?? false),
        channel: argv.channel,
        // CLI flag wins over settings.json. `--json-fd` is fd-only (no settings
        // equivalent — fd passing is a spawn-time concern). `--json-file` and
        // `--input-file` fall back to settings.dualOutput.* when the flag is
        // absent.
        jsonFd: argv.jsonFd,
        jsonFile: argv.jsonFile ?? settings.dualOutput?.jsonFile,
        inputFile: argv.inputFile ?? settings.dualOutput?.inputFile,
        // Precedence: explicit CLI flag > settings file > default(true).
        // NOTE: do NOT set a yargs default for `chat-recording`, otherwise argv will
        // always be true and the settings file can never disable recording.
        chatRecording: argv.chatRecording ?? settings.general?.chatRecording ?? true,
        defaultFileEncoding: settings.general?.defaultFileEncoding,
        lsp: {
            enabled: lspEnabled,
        },
        agents: settings.agents
            ? {
                displayMode: settings.agents.displayMode,
                arena: settings.agents.arena
                    ? {
                        worktreeBaseDir: settings.agents.arena.worktreeBaseDir,
                        preserveArtifacts: settings.agents.arena.preserveArtifacts ?? false,
                    }
                    : undefined,
            }
            : undefined,
    });
    if (lspEnabled) {
        try {
            const lspService = new NativeLspService(config, config.getWorkspaceContext(), appEvents, fileService, ideContextStore, {
                requireTrustedWorkspace: folderTrust,
            });
            await lspService.discoverAndPrepare();
            await lspService.start();
            lspClient = new NativeLspClient(lspService);
            config.setLspClient(lspClient);
        }
        catch (err) {
            debugLogger.warn('Failed to initialize native LSP service:', err);
        }
    }
    return config;
}
//# sourceMappingURL=config.js.map