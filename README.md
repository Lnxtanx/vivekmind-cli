# VivekMind

VivekMind is an open-source terminal AI coding agent for developers who want a fast, provider-flexible assistant inside their shell. The CLI is published as `vivekmind` and uses `vm` as the short product identity in prompts, banners, and project-facing copy.

VivekMind is built for local-first, bring-your-own-key workflows. It supports modern coding-agent features such as interactive chat, tool use, project memory, slash commands, MCP servers, subagents, and provider integrations including OpenAI-compatible APIs, Anthropic, Gemini, and AWS Bedrock.

## Installation

```bash
npm install -g vivekmind
```

Then start the CLI:

```bash
vivekmind
```

For one-shot prompts:

```bash
vivekmind -p "explain this repository"
```

## Configuration

User settings live in:

```text
~/.vivekmind/settings.json
```

Project-level commands, skills, agents, memory, and rules use the project `.vivekmind/` directory. Files ignored only by VivekMind can be listed in `.vivekmindignore`.

## Highlights

- Open-source terminal AI coding assistant.
- Bring your own model keys.
- Provider-flexible architecture.
- AWS Bedrock support.
- MCP server and tool integration.
- Project and user-level skills, agents, and commands.
- Interactive and non-interactive CLI modes.

## Attribution

VivekMind is a fork of VivekMind, originally developed by Google LLC and Alibaba Cloud.

VivekMind is copyright (C) 2025 Google LLC and Alibaba Cloud, and is used under the Apache License, Version 2.0.

VivekMind modifications are copyright (C) 2026 VivekMind.

The original upstream project is available at:

```text
https://github.com/QwenLM/qwen-code
```

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
