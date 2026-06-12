type Model = string;
type TokenCount = number;

/**
 * Token limit types for different use cases.
 * - 'input': Maximum input context window size
 * - 'output': Maximum output tokens that can be generated in a single response
 */
export type TokenLimitType = 'input' | 'output';

export const DEFAULT_TOKEN_LIMIT: TokenCount = 131_072; // 128K (power-of-two)
export const DEFAULT_OUTPUT_TOKEN_LIMIT: TokenCount = 32_000; // 32K tokens

// Capped default for slot-reservation optimization. 99% of outputs are under 5K
// tokens, so 32K defaults over-reserve 4-6× slot capacity. With the cap
// enabled, <1% of requests hit the limit; those get one clean retry at 64K
// (see geminiChat.ts max_output_tokens escalation).
export const CAPPED_DEFAULT_MAX_TOKENS: TokenCount = 8_000;
export const ESCALATED_MAX_TOKENS: TokenCount = 64_000;

/**
 * Accurate numeric limits:
 * - power-of-two approximations (128K -> 131072, 256K -> 262144, etc.)
 * - vendor-declared exact values (e.g., 200k -> 200000, 1m -> 1000000) are
 *   used as stated in docs.
 */
const LIMITS = {
  '32k': 32_768,
  '64k': 65_536,
  '128k': 131_072,
  '192k': 196_608, // MiniMax-M2.5 context window
  '200k': 200_000, // vendor-declared decimal, used by OpenAI, Anthropic, etc.
  '256k': 262_144,
  '272k': 272_000, // vendor-declared decimal, GPT-5.x input (400K total - 128K output)
  '384k': 384_000, // vendor-declared decimal, DeepSeek V4 max output
  '400k': 400_000, // vendor-declared decimal, used by OpenAI GPT-5.x
  '512k': 524_288,
  '1m': 1_000_000,
  // Output token limits (typically much smaller than input limits)
  '4k': 4_096,
  '8k': 8_192,
  '16k': 16_384,
} as const;

/** Robust normalizer: strips provider prefixes, pipes/colons, date/version suffixes, etc. */
export function normalize(model: string): string {
  let s = (model ?? '').toLowerCase().trim();

  // keep final path segment (strip provider prefixes), handle pipe
  s = s.replace(/^.*\//, '');
  s = s.split('|').pop() ?? s;
  
  // Bedrock models often have colons (e.g., -v1:0). Only split on colon if it's a provider prefix (e.g., ft:gpt-4), not a version suffix.
  if (s.includes(':') && !s.match(/-v\d+:\d+$/)) {
    s = s.split(':').pop() ?? s;
  }
  
  // Strip Bedrock region and provider prefixes (e.g., us.anthropic.claude, meta.llama, zai.glm, deepseek.v3)
  // Also covers Alibaba/Qwen models (e.g., qwen/qwen-coder, us.ali.qwen)
  s = s.replace(/^(?:us\.|eu\.|ap\.)?(?:anthropic|meta|mistral|cohere|amazon|deepseek|vivekmind|zai|ai21|twelvelabs|writer|google|qwen)\./, '');

  // collapse whitespace to single hyphen
  s = s.replace(/\s+/g, '-');

  // remove trailing build / date / revision suffixes:
  // - dates (e.g., -20250219), -v1, version numbers, 'latest', 'preview' etc.
  s = s.replace(/-preview/g, '');
  // Special handling for model names that include date/version as part of the model identifier
  // - VivekMind models: vivekmind-plus-latest, vivekmind-flash-latest, vivekmind-vl-max-latest
  // - Kimi models: kimi-k2-0905, kimi-k2-0711, etc. (keep date for version distinction)
  if (
    !s.match(/^vivekmind-(?:plus|flash|vl-max)-latest$/) &&
    !s.match(/^kimi-k2-\d{4}$/)
  ) {
    // Regex breakdown:
    // -(?:...)$ - Non-capturing group for suffixes at the end of the string
    // The following patterns are matched within the group:
    //   \d{4,} - Match 4 or more digits (dates) like -20250219 -0528 (4+ digit dates)
    //   \d+x\d+b - Match patterns like 4x8b, -7b, -70b
    //   v\d+(?:\.\d+)* - Match version patterns starting with 'v' like -v1, -v1.2, -v2.1.3
    //   (?<=-[^-]+-)\d+(?:\.\d+)+ - Match version numbers with dots that are preceded by another dash,
    //     like -1.1, -2.0.1 but only when they are preceded by another dash, Example: model-test-1.1 → model-test;
    //     Note: this does NOT match 4.1 in gpt-4.1 because there's no dash before -4.1 in that context.
    //   latest|exp - Match the literal string "latest" or "exp"
    s = s.replace(
      /-(?:\d{4,}|\d+x\d+b|v\d+(?:\.\d+)*|(?<=-[^-]+-)\d+(?:\.\d+)+|latest|exp)$/g,
      '',
    );
  }

  // remove quantization / numeric / precision suffixes common in local/community models
  s = s.replace(/-(?:\d?bit|int[48]|bf16|fp16|q[45]|quantized)$/g, '');

  return s;
}

/** Ordered regex patterns: most specific -> most general (first match wins). */
const PATTERNS: Array<[RegExp, TokenCount]> = [
  // -------------------
  // Google Gemini
  // -------------------
  [/^gemini-3/, LIMITS['1m']], // Gemini 3.x (Pro, Flash, 3.1, etc.): 1M
  [/^gemini-2\.5/, LIMITS['1m']], // Gemini 2.5: 1M
  [/^gemini-/, LIMITS['1m']], // Gemini fallback: 1M

  // -------------------
  // OpenAI
  // -------------------
  [/^gpt-5\.2/, LIMITS['400k']], // GPT-5.2: 400K
  [/^gpt-5/, LIMITS['272k']], // GPT-5.x: 272K input (400K total - 128K output)
  [/^gpt-4\.1/, LIMITS['1m']], // GPT-4.1: 1M
  [/^gpt-/, LIMITS['128k']], // GPT fallback (4o, etc.): 128K
  [/^o\d/, LIMITS['200k']], // o-series (o3, o4-mini, etc.): 200K

  // -------------------
  // Anthropic Claude
  // -------------------
  [/^claude-opus-4-7/, LIMITS['1m']], // Claude 4.7 Opus: 1M
  [/^claude-sonnet-4-6/, LIMITS['1m']], // Claude 4.6 Sonnet: 1M
  [/^claude-/, LIMITS['200k']], // All other Claude models: 200K

  // -------------------
  // Amazon Nova (Bedrock)
  // -------------------
  [/^nova-/, LIMITS['1m']], // Amazon Nova: 1M

  // -------------------
  // Alibaba / Qwen
  // -------------------
  // Qwen Codex (Qwen3) models: 32K context
  [/^qwen3-coder/, LIMITS['32k']],
  [/^qwen3\./, LIMITS['32k']],
  // Qwen2.5 models: 128K
  [/^qwen2\.5/, LIMITS['128k']],
  // Qwen2 models: 128K
  [/^qwen2$/, LIMITS['128k']],
  [/^qwen2-/, LIMITS['128k']],
  // Qwen1.5 models: 32K-128K (fallback to 128K for newer variants)
  [/^qwen1\.5/, LIMITS['128k']],
  // Qwen fallback: 32K for older versions
  [/^qwen$/, LIMITS['32k']],
  [/^qwen-/, LIMITS['32k']],

  // -------------------
  // Alibaba / VivekMind
  // -------------------
  // Commercial API models (1,000,000 context)
  [/^vivekmind3-coder/, LIMITS['1m']],
  [/^vivekmind3\.\d/, LIMITS['1m']],
  [/^vivekmind-plus-latest$/, LIMITS['1m']],
  [/^vivekmind-flash-latest$/, LIMITS['1m']],
  [/^coder-model$/, LIMITS['1m']],
  // Commercial API models (256K context)
  [/^vivekmind3-max/, LIMITS['256k']],
  // Open-source VivekMind3 variants: 256K native
  [/^vivekmind3-coder-/, LIMITS['256k']],
  // VivekMind fallback (VL, turbo, plus, 2.5, etc.): 128K
  [/^vivekmind/, LIMITS['256k']],

  // -------------------
  // DeepSeek
  // -------------------
  [/^v3\.2/, LIMITS['128k']], // DeepSeek V3.2 (Bedrock normalization)
  [/^deepseek-v4/, LIMITS['1m']], // DeepSeek V4 (flash, pro): 1M
  [/^deepseek/, LIMITS['128k']],

  // -------------------
  // Zhipu GLM
  // -------------------
  [/^glm-5/, 202_752 as TokenCount], // GLM-5: exact vendor limit
  [/^glm-4/, 128_000 as TokenCount], // GLM-4: 128K
  [/^glm-3/, 32_768 as TokenCount], // GLM-3: 32K
  [/^glm-/, 128_000 as TokenCount], // GLM fallback: 128K

  // -------------------
  // MiniMax
  // -------------------
  [/^minimax-m2\.5/i, LIMITS['192k']], // MiniMax-M2.5: 196,608
  [/^minimax-/i, LIMITS['200k']], // MiniMax fallback: 200K

  // -------------------
  // Moonshot / Kimi
  // -------------------
  [/^kimi-/, LIMITS['256k']], // Kimi fallback: 256K

  // -------------------
  // Mistral AI
  // -------------------
  [/^devstral/, LIMITS['128k']], // Devstral: 128K
  [/^codestral/, LIMITS['256k']], // Codestral: 256K
  [/^mistral-large/, LIMITS['128k']], // Mistral Large: 128K
  [/^mistral-small/, LIMITS['32k']], // Mistral Small: 32K
  [/^mistral/, LIMITS['128k']], // Mistral fallback: 128K

  // -------------------
  // xAI / Grok
  // -------------------
  [/^grok-/, LIMITS['128k']], // Grok models: 128K

  // -------------------
  // Reka AI
  // -------------------
  [/^reka-/, LIMITS['128k']], // Reka Core/Flash: 128K

  // -------------------
  // Perplexity Sonar
  // -------------------
  [/^sonar/, LIMITS['128k']], // Sonar Pro/Sonar: 128K

  // -------------------
  // Cohere Command R
  // -------------------
  [/^command-r/, LIMITS['128k']], // Command R+/R: 128K

  // -------------------
  // NVIDIA Nemotron
  // -------------------
  [/^nemotron-/, LIMITS['128k']],

  // -------------------
  // Meta Llama (via Groq, Together, Fireworks, etc.)
  // -------------------
  [/^llama-3/, LIMITS['128k']], // Llama 3.x: 128K
  [/^llama3/, LIMITS['128k']], // Llama3 (Ollama naming): 128K

  // -------------------
  // ByteDance Seed-OSS (512K)
  // -------------------
  [/^seed-oss/, LIMITS['512k']],
];

/**
 * Output token limit patterns for specific model families.
 * These patterns define the maximum number of tokens that can be generated
 * in a single response for specific models.
 */
const OUTPUT_PATTERNS: Array<[RegExp, TokenCount]> = [
  // Google Gemini
  [/^gemini-3/, LIMITS['64k']], // Gemini 3.x: 64K
  [/^gemini-2\.5/, LIMITS['16k']], // Gemini 2.5: 16K
  [/^gemini-/, LIMITS['8k']], // Gemini fallback: 8K

  // OpenAI
  [/^gpt-5\.2/, LIMITS['128k']], // GPT-5.2: 128K
  [/^gpt-5/, LIMITS['128k']], // GPT-5.x: 128K
  [/^gpt-4\.1/, LIMITS['128k']], // GPT-4.1: 128K
  [/^gpt-/, LIMITS['16k']], // GPT fallback: 16K
  [/^o\d/, LIMITS['128k']], // o-series: 128K

  // Anthropic Claude
  [/^claude-opus-4-7/, LIMITS['128k']], // Opus 4.7: 128K
  [/^claude-sonnet-4-6/, LIMITS['64k']], // Sonnet 4.6: 64K
  [/^claude-opus-4-6/, LIMITS['128k']], // Opus 4.6: 128K
  [/^claude-/, LIMITS['64k']], // Claude fallback: 64K

  // Alibaba / Qwen
  [/^qwen3-coder/, LIMITS['8k']],
  [/^qwen3\./, LIMITS['8k']],
  [/^qwen2\.5/, LIMITS['8k']],
  [/^qwen2$/, LIMITS['8k']],
  [/^qwen2-/, LIMITS['8k']],
  [/^qwen1\.5/, LIMITS['8k']],
  [/^qwen$/, LIMITS['4k']],
  [/^qwen-/, LIMITS['4k']],

  // Alibaba / VivekMind
  [/^vivekmind3-coder/, LIMITS['64k']],
  [/^vivekmind3\.\d/, LIMITS['64k']],
  [/^coder-model$/, LIMITS['64k']],
  [/^vivekmind/, LIMITS['32k']], // VivekMind fallback (VL, turbo, plus, etc.): 8K

  // DeepSeek
  [/^v3\.2/, LIMITS['8k']],
  [/^deepseek-v4/, LIMITS['384k']], // DeepSeek V4 (flash, pro): 384K
  [/^deepseek-reasoner/, LIMITS['64k']],
  [/^deepseek-r1/, LIMITS['64k']],
  [/^deepseek-chat/, LIMITS['8k']],

  // Zhipu GLM
  [/^glm-5/, LIMITS['16k']],
  [/^glm-4\.7/, LIMITS['16k']],
  [/^glm-4/, LIMITS['8k']],      // GLM-4: 8K
  [/^glm-3/, LIMITS['4k']],      // GLM-3: 4K
  [/^glm-/, LIMITS['8k']],       // GLM fallback: 8K

  // MiniMax
  [/^minimax-m2\.5/i, LIMITS['64k']],

  // Kimi
  [/^kimi-k2\.5/, LIMITS['32k']],

  // Mistral AI
  [/^codestral/, LIMITS['16k']], // Codestral: 16K
  [/^mistral-large/, LIMITS['8k']], // Mistral Large: 8K

  // xAI / Grok
  [/^grok-3/, LIMITS['32k']], // Grok 3: 32K

  // Cohere Command R
  [/^command-r/, LIMITS['4k']], // Command R+/R: 4K
];

function findTokenLimit(
  model: Model,
  type: TokenLimitType = 'input',
): TokenCount | undefined {
  const norm = normalize(model);
  const patterns = type === 'output' ? OUTPUT_PATTERNS : PATTERNS;

  for (const [regex, limit] of patterns) {
    if (regex.test(norm)) {
      return limit;
    }
  }

  return undefined;
}

/**
 * Check if a model has an explicitly defined output token limit.
 * This distinguishes between models with known limits in OUTPUT_PATTERNS
 * and unknown models that would fallback to DEFAULT_OUTPUT_TOKEN_LIMIT.
 *
 * @param model - The model name to check
 * @returns true if the model has an explicit output limit definition, false if it uses the default fallback
 */
export function hasExplicitOutputLimit(model: Model): boolean {
  const norm = normalize(model);
  return OUTPUT_PATTERNS.some(([regex]) => regex.test(norm));
}

export function knownTokenLimit(
  model: Model,
  type: TokenLimitType = 'input',
): TokenCount | undefined {
  return findTokenLimit(model, type);
}

/**
 * Return the token limit for a model string based on the specified type.
 *
 * This function determines the maximum number of tokens for either input context
 * or output generation based on the model and token type. It uses the same
 * normalization logic for consistency across both input and output limits.
 *
 * This function is primarily used during config initialization to auto-detect
 * token limits. After initialization, code should use contentGeneratorConfig.contextWindowSize
 * or contentGeneratorConfig.maxOutputTokens directly.
 *
 * @param model - The model name to get the token limit for
 * @param type - The type of token limit ('input' for context window, 'output' for generation)
 * @returns The maximum number of tokens allowed for this model and type
 */
export function tokenLimit(
  model: Model,
  type: TokenLimitType = 'input',
): TokenCount {
  return (
    knownTokenLimit(model, type) ??
    (type === 'output' ? DEFAULT_OUTPUT_TOKEN_LIMIT : DEFAULT_TOKEN_LIMIT)
  );
}
