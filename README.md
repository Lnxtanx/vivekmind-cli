# VivekMind CLI

VivekMind CLI is a high-performance agentic coding assistant optimized for AWS Bedrock. This standalone tool provides direct integration with Amazon Bedrock's model ecosystem, supporting high-efficiency reasoning and multi-file code generation via a Zero-Auth local environment flow.

## Core Features

- **AWS Bedrock Optimization**: Direct integration with Amazon Bedrock infrastructure.
- **High-Performance Model Support**: Native support for MiniMax M2.5, DeepSeek V3.2, Qwen3 Coder, Mistral Large, and GLM 5.
- **Agentic Workflows**: Context-aware reasoning, automated refactoring, and multi-file task execution.
- **Simplified Authentication**: Implicit credential detection using standard AWS environment variables.
- **Enhanced Terminal Interface**: Optimized UI with custom gradients and layout support.

## Model Tiers

| Tier | Primary Models | Application |
| :--- | :--- | :--- |
| Elite | MiniMax M2.5, DeepSeek V3.2 | Advanced refactoring and complex agentic tasks. |
| Strong | GLM 5, Mistral Large 3 | General-purpose development and reasoning. |
| Solid | Llama3 70B, GPT OSS 120B | Routine boilerplate and code reviews. |
| Reasoning | Kimi K2 Thinking, Nova Pro | Deep analysis and architectural planning. |

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Lnxtanx/vivekmind-cli.git
   cd vivekmind-cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and link:
   ```bash
   npm run build --workspace=packages/cli
   cd packages/cli
   npm link
   ```

## Configuration

VivekMind CLI utilizes standard AWS credentials. Ensure the following environment variables are set:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

## Usage

Execute the following command to start the agent:

```bash
vivekmind
```

### Key Commands:
- `/model`: Select active model tier.
- `/clear`: Reset session context.
- `/quit`: Terminate session and save statistics.

## Links

- **Website**: [vivekmind.com](https://vivekmind.com)
- **Author**: [Vivek Kumar Yadav](https://github.com/Lnxtanx)

## License and Credits

VivekMind CLI is developed and maintained by Vivek Kumar Yadav.

This project is a modified distribution of Qwen Code.
Copyright © 2026 VivekMind. All rights reserved.
Original Qwen Code Copyright © 2025 Google LLC & Alibaba.
Licensed under the Apache-2.0 License.
