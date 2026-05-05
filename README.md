# 🧠 VivekMind CLI

**VivekMind CLI** is a high-performance, agentic coding assistant designed for elite developers. Originally based on the Qwen Code framework, this fork has been completely re-engineered to provide a standalone, **AWS Bedrock-exclusive** experience with Zero-Auth local credential support.

![VivekMind Logo](https://vivekmind.com/favicon.ico)

## 🚀 Key Features

- **Exclusive AWS Bedrock Integration**: Seamlessly connects to Amazon Bedrock's global infrastructure.
- **Elite Model Ecosystem**: Support for SOTA coding models including **MiniMax M2.5**, **DeepSeek V3.2**, **Qwen3 Coder**, **Mistral Large**, and **GLM 5**.
- **Agentic Coding Capabilities**: Multi-file reasoning, automated refactoring, and context-aware terminal execution.
- **Zero-Auth DX**: Automatically detects `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` from your local environment or `~/.qwen/.env`.
- **Premium Terminal UI**: Redesigned header and ASCII art with customizable gradients and modern layouts.

## 🛠️ Model Tiers

VivekMind comes pre-configured with the industry's top-performing LLMs across four specialized tiers:

| Tier | Best Models | Purpose |
| :--- | :--- | :--- |
| **🥇 Elite** | `MiniMax M2.5`, `DeepSeek V3.2`, `Kimi K2.5` | Complex refactors, multi-file agentic tasks. |
| **🥈 Strong** | `GLM 5`, `Mistral Large 3`, `Nemotron 120B` | General purpose coding and reasoning. |
| **🥉 Solid** | `Llama3 70B`, `GPT OSS 120B`, `Mixtral 8x7B` | Fast reviews, boilerplate, and routine logic. |
| **🧠 Thinking** | `Kimi K2 Thinking`, `Nova Pro` | Deep debugging and architectural design. |

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Lnxtanx/vivekmind-cli.git
   cd vivekmind-cli
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build and Link**:
   ```bash
   npm run build --workspace=packages/cli
   cd packages/cli
   npm link
   ```

## 🔑 Authentication

VivekMind requires no interactive login. Simply set your AWS credentials in your environment:

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

Or place them in `~/.qwen/.env`.

## 🎮 Usage

Start the agent from any project directory:

```bash
vivekmind
```

### Useful Commands:
- `/model`: Switch between Elite, Strong, and Thinking models.
- `/clear`: Reset the current conversation context.
- `/quit`: Power down the agent and save session stats.

## 🔗 Links & Community

- **Official Website**: [vivekmind.com](https://vivekmind.com)
- **Support**: [vivekmind.com/support](https://vivekmind.com/support)
- **Author**: [Vivek Kumar Yadav](https://github.com/Lnxtanx)

## 📝 License & Credits

VivekMind CLI is built and maintained by **Vivek Kumar Yadav**.

This project is a modified fork of Qwen Code.
© 2026 **VivekMind** ([vivekmind.com](https://vivekmind.com)). All rights reserved.
Original Qwen Code © 2025 Google LLC & Alibaba.
Licensed under the Apache-2.0 License.
