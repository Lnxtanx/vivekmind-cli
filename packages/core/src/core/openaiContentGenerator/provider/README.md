# Provider Structure

This folder contains the different provider implementations for VivekMind's OpenAI-compatible content generator.

## File Structure

- `types.ts` - Type definitions and interfaces for providers
- `default.ts` - Default provider for standard OpenAI-compatible APIs
- `dashscope.ts` - DashScope (Qwen) specific provider implementation
- `deepseek.ts` - DeepSeek provider with content flattening and reasoning effort
- `openrouter.ts` - OpenRouter specific headers and configurations
- `modelscope.ts` - ModelScope provider implementation
- `minimax.ts` - MiniMax provider with tagged thinking support
- `groq.ts` - Groq ultra-fast inference provider
- `together.ts` - Together AI provider
- `xai.ts` - xAI/Grok provider
- `mistral.ts` - Mistral AI provider
- `index.ts` - Main export file for all providers

## Provider Types

### Default Provider

The `DefaultOpenAICompatibleProvider` is the fallback provider for standard OpenAI-compatible APIs. It provides basic functionality without special enhancements and passes through all request parameters. This also covers providers like Fireworks AI, Perplexity, Moonshot/Kimi, Reka AI, Cohere (via compatibility endpoint), and Ollama that are fully OpenAI-compatible with no special handling needed.

### DashScope Provider

The `DashScopeOpenAICompatibleProvider` handles DashScope (Qwen) specific features like cache control and metadata.

### DeepSeek Provider

The `DeepSeekOpenAICompatibleProvider` handles DeepSeek-specific content part flattening and reasoning effort translation.

### OpenRouter Provider

The `OpenRouterOpenAICompatibleProvider` handles OpenRouter specific headers (`HTTP-Referer`, `X-OpenRouter-Title`).

### MiniMax Provider

The `MiniMaxOpenAICompatibleProvider` handles MiniMax-specific tagged thinking parsing.

### Groq Provider

The `GroqOpenAICompatibleProvider` adds source tracking headers (`X-Groq-Source`) for Groq's ultra-fast inference API.

### Together AI Provider

The `TogetherOpenAICompatibleProvider` adds source tracking headers for Together AI's inference API.

### xAI/Grok Provider

The `XAIOpenAICompatibleProvider` provides hostname detection for xAI's Grok models. Future-proofed for Grok-specific reasoning content handling.

### Mistral AI Provider

The `MistralOpenAICompatibleProvider` provides hostname detection for Mistral AI. Future-proofed for Codestral FIM support.

## Adding a New Provider

To add a new provider:

1. Create a new file (e.g., `newprovider.ts`) in this folder
2. Extend `DefaultOpenAICompatibleProvider` or implement the `OpenAICompatibleProvider` interface
3. Add a static method to identify if a config belongs to this provider (use safe URL hostname parsing)
4. Export the class from `index.ts`
5. Register the provider in `determineProvider()` in the parent `index.ts`

## Provider Interface

All providers must implement:

- `buildHeaders()` - Build HTTP headers for the provider
- `buildClient()` - Create and configure the OpenAI client
- `buildRequest()` - Transform requests before sending to the provider
- `getDefaultGenerationConfig()` - Default generation parameters

Optional:
- `getResponseParsingOptions()` - Configure response parsing (e.g., tagged thinking)

## Example

```typescript
export class NewProviderOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
  static isNewProvider(config: ContentGeneratorConfig): boolean {
    if (!config.baseUrl) return false;
    try {
      const hostname = new URL(config.baseUrl).hostname.toLowerCase();
      return hostname === 'api.newprovider.com';
    } catch {
      return false;
    }
  }

  override buildHeaders(): Record<string, string | undefined> {
    return {
      ...super.buildHeaders(),
      'X-Custom-Header': 'value',
    };
  }
}
```
