/**
 * @fileoverview Model capability inspection, categorization, and validation.
 * Detects vision support, reasoning models, and rejects embedding-only models before making inference calls.
 */

const { PROVIDERS } = require('../shared/validation');

// Known vision model patterns across providers
const VISION_PATTERNS = [
  /gpt-4o/i,
  /gpt-4-turbo/i,
  /gpt-4-vision/i,
  /claude-3/i,
  /claude-3-5/i,
  /gemini-1\.5/i,
  /gemini-2/i,
  /llava/i,
  /bakllava/i,
  /qwen2\.5-vl/i,
  /qwen-vl/i,
  /llama-?3\.2-vision/i,
  /minicpm-v/i,
  /vision/i
];

// Known extended reasoning / thinking models
const REASONING_PATTERNS = [
  /^o1/i,
  /^o3/i,
  /deepseek-r1/i,
  /qwq/i,
  /thinking/i
];

// Embedding-only models that cannot be used for chat or explanation
const EMBEDDING_PATTERNS = [
  /text-embedding/i,
  /embedding/i,
  /bge-/i,
  /nomic-embed/i,
  /all-minilm/i,
  /e5-/i,
  /gte-/i,
  /sentence-transformers/i
];

/**
 * Inspects a model identifier and provider to determine capabilities and constraints.
 * @param {string} provider Provider ID ('ollama', 'openai', 'anthropic', 'gemini', 'compatible')
 * @param {string} modelId Model identifier string (e.g. 'qwen3:1.7b', 'gpt-4o', 'text-embedding-3-small')
 * @returns {{
 *   isEmbedding: boolean,
 *   supportsVision: boolean,
 *   supportsReasoning: boolean,
 *   isLocal: boolean,
 *   destinationLabel: string,
 *   warning?: string
 * }}
 */
function inspectModel(provider, modelId = '') {
  if (!PROVIDERS.includes(provider)) throw new Error('Unknown AI provider.');
  const trimmed = (modelId || '').trim();

  const isEmbedding = EMBEDDING_PATTERNS.some(pattern => pattern.test(trimmed));
  const supportsVision = VISION_PATTERNS.some(pattern => pattern.test(trimmed));
  const supportsReasoning = REASONING_PATTERNS.some(pattern => pattern.test(trimmed));
  const isLocal = provider === 'ollama';

  let destinationLabel = isLocal ? 'Local Ollama (on device)' : `Cloud Provider (${provider})`;
  let warning;

  if (isEmbedding) {
    warning = `"${trimmed}" is an embedding-only model and cannot generate text or answers. Please select a chat or completion model.`;
  }

  return {
    isEmbedding,
    supportsVision,
    supportsReasoning,
    isLocal,
    destinationLabel,
    warning
  };
}

// Known text-only models that explicitly lack multimodal vision support
const KNOWN_TEXT_ONLY_PATTERNS = [
  /gpt-3\.5/i,
  /text-davinci/i,
  /claude-2/i,
  /claude-instant/i,
  /gemini-1\.0-pro/i
];

/**
 * Validates model and provider suitability for a request before network or local inference starts.
 * Throws a descriptive, user-friendly error if the configuration is invalid.
 * @param {string} provider
 * @param {string} modelId
 * @param {{ sendImage?: boolean }} [options]
 */
function validateModelSelection(provider, modelId, options = {}) {
  const info = inspectModel(provider, modelId);

  if (info.isEmbedding) {
    throw new Error(`Incompatible model: "${modelId}" is an embedding model and cannot generate conversational answers. Choose a chat model such as ${provider === 'ollama' ? 'qwen3:1.7b or llama3' : 'gpt-4o or claude-3-5-sonnet'}.`);
  }

  const isKnownTextOnly = KNOWN_TEXT_ONLY_PATTERNS.some(pattern => pattern.test(modelId));
  if (options.sendImage && isKnownTextOnly) {
    throw new Error(`Model "${modelId}" does not support image inputs. Uncheck "Send screenshot image directly" in AI settings to use OCR text mode, or select a vision-capable model.`);
  }

  return info;
}

module.exports = {
  inspectModel,
  validateModelSelection,
  VISION_PATTERNS,
  REASONING_PATTERNS,
  EMBEDDING_PATTERNS,
  KNOWN_TEXT_ONLY_PATTERNS
};
