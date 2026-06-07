<p align="center">
  <img src="https://vivekmind.com/favicon.ico" alt="VivekMind" width="64" height="64" />
</p>

<h1 align="center">VivekMind CLI</h1>

<h3 align="center"><a href="https://code.vivekmind.com">code.vivekmind.com</a></h3>

<p align="center">
  <strong>Open-source terminal AI coding agent with full AWS Bedrock support</strong>
</p>

<p align="center">
  <a href="https://github.com/Lnxtanx/vivekmind-cli/releases"><img src="https://img.shields.io/npm/v/vivekmind?style=flat-square" alt="npm" /></a>
  <a href="https://github.com/Lnxtanx/vivekmind-cli/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/vivekmind?style=flat-square" alt="license" /></a>
  <a href="https://github.com/Lnxtanx/vivekmind-cli"><img src="https://img.shields.io/node/v/vivekmind?style=flat-square" alt="node" /></a>
</p>

---

VivekMind is a fork of [Qwen Code](https://github.com/QwenLM/qwen-code) (by Google & Alibaba Cloud), tailored for developers who want a powerful, provider-flexible AI coding assistant that lives entirely inside the terminal. It ships with native AWS Bedrock integration, 20+ AI provider support, and a rich extensible architecture built around tools, skills, agents, and MCP servers.

Install it, point it at any model, and start coding — all from your shell.

---

## Quick Start

```bash
# Install globally
npm install -g vivekmind

# Launch interactive mode
vivekmind

# Or use the short alias
vm

# One-shot prompt
vivekmind -p "explain this repository"
```

Requires **Node.js >= 20**.

---

## AI Providers (20+)

VivekMind supports a wide range of AI providers out of the box. Set the corresponding environment variable and configure in `~/.vivekmind/settings.json`.

| Provider | Auth Type | Example Models |
|----------|-----------|----------------|
| **AWS Bedrock** | `bedrock` | Claude (3/3.5/4.7), Amazon Nova (Pro/Lite/Micro), Llama (3/3.1/3.3/4), Qwen Coder, GLM, Mistral, Cohere |
| **Anthropic** | `anthropic` | Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 |
| **Google Gemini** | `gemini` | Gemini 3 Pro, 2.5 Pro, 2.5 Flash |
| **OpenAI** | `openai` | GPT-5.2, 5.4 Mini, 4.1, o3, o4-mini |
| **Azure OpenAI** | `azure-openai` | GPT-5.2 (Azure) |
| **Anthropic (Vertex AI)** | `anthropic-vertex-ai` | Claude Opus 4.7 (Vertex) |
| **DeepSeek** | `deepseek` | DeepSeek Chat V3, DeepSeek Reasoner R1 |
| **Mistral AI** | `mistral` | Mistral Large, Codestral, Pixtral Large |
| **Alibaba DashScope** | `dashscope` | Qwen3 Coder Plus, Qwen VL Max |
| **xAI (Grok)** | `xai` | Grok 4 |
| **OpenRouter** | `openrouter` | Claude Opus 4.7 (OpenRouter) |
| **Groq** | `groq` | Llama 3.3 70B (Groq) |
| **Together AI** | `together` | Llama 3.3 70B (Together) |
| **Fireworks AI** | `fireworks` | Llama 4 Maverick (Fireworks) |
| **Cohere** | `cohere` | Command R+ |
| **Perplexity** | `perplexity` | Sonar Pro |
| **SiliconFlow** | `siliconflow` | DeepSeek V3 (SiliconFlow) |
| **Hugging Face** | `huggingface` | Llama 3.3 70B (HF) |
| **IBM Watsonx** | `watsonx` | Llama 4 Maverick (Watsonx) |
| **Novita AI** | `novita` | Llama 3.1 70B (Novita) |
| **Ollama** | `ollama` | Any local model (localhost:11434) |
| **LM Studio** | `lm-studio` | Any loaded model (localhost:1234) |

### AWS Bedrock Setup

AWS Bedrock works with your existing AWS credentials. No additional API key is needed. VivekMind supports the full list of AWS Bedrock models, including **Anthropic Claude** (3/3.5/4.7), **Amazon Nova** (Pro/Lite/Micro), **Meta Llama** (3/3.3/4), **Qwen Coder** models, **GLMs**, **Mistral**, and **Cohere Command**:

```bash
# Ensure AWS credentials are set
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret

# Start VivekMind
vivekmind
```

Bedrock models are auto-discovered via the `ListFoundationModels` API. You can configure and name specific models in `settings.json`:

```json
{
  "modelProviders": {
    "bedrock": [
      {
        "id": "anthropic.claude-opus-4-7",
        "name": "Claude Opus 4.7 (Bedrock)",
        "capabilities": { "vision": true },
        "generationConfig": { "contextWindowSize": 1000000 }
      },
      {
        "id": "amazon.nova-pro-v1",
        "name": "Amazon Nova Pro",
        "capabilities": { "vision": true },
        "generationConfig": { "contextWindowSize": 1000000 }
      }
    ]
  }
}
```

---

## Features

### Built-in Tools

VivekMind gives the AI agent direct access to powerful tools for real coding workflows:

| Tool | Description |
|------|-------------|
| `Edit` | Search-and-replace file editing |
| `WriteFile` | Create or overwrite files |
| `ReadFile` | Read file contents |
| `Grep` | Regex search across files (bundled ripgrep) |
| `Glob` | Find files by pattern |
| `Shell` | Execute shell commands |
| `TodoWrite` | Track and manage task progress |
| `Agent` | Spawn subagents for complex multi-step tasks |
| `WebFetch` | Fetch and read web pages |
| `Lsp` | Language Server Protocol integration |
| `SaveMemory` | Save information to project memory |
| `CronCreate/CronList/CronDelete` | Schedule and manage tasks |
| `SendMessage` | Send messages via channel integrations |
| `Monitor` | Watch files and processes for changes |

Plus any tools discovered from connected **MCP servers**.

### Slash Commands

Over 40 built-in commands for session control, configuration, and workflow management:

```
/model          Switch AI model
/compress       Compress chat history to save context
/clear          Clear conversation
/memory         Open memory manager
/remember       Save info to memory
/forget         Remove info from memory
/skills         List available skills
/tools          List available tools
/mcp            Manage MCP servers
/agents         Manage subagents
/arena          Compare models head-to-head
/export         Export conversation (HTML, Markdown, JSON)
/resume         Resume a previous session
/rewind         Rewind to a previous state
/plan           Enter planning mode
/hooks          Manage pre/post tool execution hooks
/settings       Open settings dialog
/theme          Change terminal theme
/vim            Toggle vim mode
/init           Initialize project configuration
/doctor         Run diagnostic checks
/channel        Manage messaging channels (start, stop, status, list, configure-telegram)
```

Create custom slash commands by adding `.md` files to `.vivekmind/commands/`.

### Memory System

VivekMind remembers your project context automatically:

- **Auto-extraction** — Key facts are extracted from every conversation turn
- **Dream consolidation** — Periodically merges and deduplicates memory entries
- **Relevance recall** — Relevant memories are injected into future prompts
- **Manual control** — Use `/remember`, `/forget`, `/memory`, and `/dream` to manage memories
- **Per-project storage** — Memories live in `~/.vivekmind/auto-memory/` by project

### Subagents

Break complex tasks into parallel, focused workflows:

- Built-in agents: `general-purpose`, `Explore` (read-only exploration)
- Define custom agents as `.md` files in `.vivekmind/agents/`
- Configure tool subsets, model preferences, and generation methods
- Run in tmux, iTerm, or in-process
- Supports background tasks with notifications

### Skills System

Layer reusable knowledge and automation on top of the base agent:

- **4 skill levels**: project > user > extension > bundled (precedence order)
- **Conditional activation** — Skills trigger based on file path patterns
- **Hooks** — Define pre/post execution hooks (shell commands or HTTP calls)
- **Live reload** — File watcher auto-refreshes skill cache on changes
- Place skills in `.vivekmind/skills/` with `SKILL.md` files

### MCP (Model Context Protocol)

Connect to any MCP-compatible server to extend tool capabilities:

- Full MCP client via `@modelcontextprotocol/sdk`
- Discover tools, prompts, and resources dynamically
- OAuth support with Google Auth and service account impersonation
- Add servers via `/mcp` command or `settings.json`
- Tools from MCP servers appear alongside built-in tools

### Channel Integrations

Connect VivekMind to messaging platforms as a bot:

```bash
# Interactive Telegram setup
vivekmind channel configure-telegram

# Start a channel
vivekmind channel start my-telegram
```

#### Supported Channels

| Channel | Status | Description |
|---------|--------|-------------|
| **Telegram** | **Full support (grammY)** | High-fidelity integration with interactive tool approvals, multi-choice question prompts, and real-time SSE progress reporting. |
| **WeChat / Weixin** | Adapter available | Standard chat adapter. |
| **DingTalk** | Adapter available | Standard chat adapter. |
| **Custom** | Plugin framework | Build your own channel via `@vivekmind/channel-base`. |

#### Telegram Channel Features

VivekMind provides an industry-leading user experience for Telegram users:
- **Interactive Tool Confirmation:** Confirm tool calls (such as writes or executing commands) directly inside your Telegram chat using inline approval buttons (**Allow Once**, **Always Allow**, **Deny**).
- **Interactive Question Prompts:** Responds to multi-choice prompts (like `askUserQuestion`) using numbered interactive buttons.
- **Real-Time Tool Status Display:** Follows the agent's work step-by-step:
  - Prints a dynamic `> Thinking...` card on start.
  - Lists each tool on its own line: `  {toolIcon} [tool_name] status` using text labels instead of emojis (e.g. `🔍 [read_file] completed`, `✏️ [write_file] in progress`).
  - Limits output to max 8 lines, truncating and grouping older steps as `  +N more`.
  - Appends a status footer showing completed vs active tool counts and elapsed execution seconds: `  N tools done, M active, Xs`.
  - Updates the card to `> Done — X tools completed in Ys` upon execution completion and deletes itself after 5 seconds to keep the chat clean (or instantly clears the card when text response streaming begins).

Channel configuration lives in `settings.json` under the `channels` key. See `settings.example.json` for templates.

### Non-Interactive / Headless Mode

Integrate VivekMind into scripts and CI pipelines:

```bash
# One-shot prompt with text output
vivekmind -p "fix the bug in auth.ts"

# JSON output for programmatic use
vivekmind -p "list all TODOs" --output json

# Stream JSON for real-time processing
vivekmind -p "refactor module" --output stream-json
```

### Additional Features

- **Sandbox** — Docker and Podman sandbox support for safe code execution
- **LSP Integration** — Language Server Protocol for code intelligence
- **Extensions** — Install community extensions from GitHub or npm
- **i18n** — English, Chinese (zh, zh-TW), Japanese, German, French, Russian, Portuguese, Catalan
- **Themes** — 15+ built-in terminal themes (dark, light, dracula, github, ayu, etc.)
- **Vim Mode** — Full vim keybinding support
- **Session Management** — Resume, rewind, rename, export, and delete sessions
- **Hooks** — Pre/post tool execution hooks (shell commands and HTTP)
- **Git Integration** — Branch detection, PR review, presubmit checks
- **Syntax Highlighting** — Tree-sitter powered with WASM
- **Cron Jobs** — Schedule recurring tasks from within the CLI
- **Arena Mode** — Compare models head-to-head on the same task

---

## Configuration

### Settings

User settings live in `~/.vivekmind/settings.json`. Copy from the template:

```bash
cp settings.example.json ~/.vivekmind/settings.json
```

Or run VivekMind and it will auto-create the file on first run.

**Security**: Never put real API keys in `settings.json`. Use the `envKey` field to reference environment variables.

### Project Configuration

The `.vivekmind/` directory in your project root holds:

```
.vivekmind/
  commands/       Custom slash commands (.md files)
  skills/         Custom skills (SKILL.md files)
  agents/         Custom subagents (.md files)
  VIVEKMIND.md    Project rules and context (always loaded)
```

Use `.vivekmindignore` to exclude files from VivekMind's attention.

### Environment Variables

Reference API keys via environment variables in `settings.json`:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GEMINI_API_KEY=...
export DEEPSEEK_API_KEY=...
export DASHSCOPE_API_KEY=...
export MISTRAL_API_KEY=...
# etc.
```

For AWS Bedrock, use standard AWS credentials:

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

---

## Project Structure

```
vivekmind-cli/
  packages/
    cli/                  Main CLI application (React + Ink terminal UI)
    core/                 Core agent logic, providers, tools, memory, MCP
    web-templates/        HTML/CSS templates for export and reports
    channels/
      base/               Channel framework (ACP bridge, session router)
      telegram/           Telegram bot adapter
      weixin/             WeChat adapter
      dingtalk/           DingTalk adapter
      plugin-example/     Reference channel plugin
  settings.example.json   Full configuration template
  scripts/                Build, test, and development scripts
```

---

## Development

```bash
# Clone the repo
git clone https://github.com/Lnxtanx/vivekmind-cli.git
cd vivekmind-cli

# Install dependencies
npm ci

# Start in development mode
npm run dev

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint

# Full preflight check
npm run preflight
```

---

## Attribution

VivekMind is a fork of [Qwen Code](https://github.com/QwenLM/qwen-code), originally developed by Google LLC and Alibaba Cloud.

Qwen Code is copyright (C) 2025 Google LLC and Alibaba Cloud, and is used under the Apache License, Version 2.0.

VivekMind modifications are copyright (C) 2026 [VivekMind](https://code.vivekmind.com).

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
