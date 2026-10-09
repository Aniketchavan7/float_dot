/**
 * @fileoverview Shared JSDoc contracts, schemas, and validation for Float Dot v1.
 * Defines the core data boundaries across Main, Preload, Renderer, and Service layers.
 */

/**
 * @typedef {'explain' | 'hint' | 'debug' | 'meeting'} AssistantIntent
 * User intent for answer generation:
 * - 'explain': General explanation of visible screen or code (default)
 * - 'hint': Algorithmic/DSA hint without full code revelation
 * - 'debug': Structured root-cause analysis and defect investigation
 * - 'meeting': Transcript summarization and action items
 */

/**
 * @typedef {Object} CaptureQuality
 * @property {number} confidence OCR recognition confidence (0-100)
 * @property {boolean} truncated Whether extracted text was truncated due to length limits
 */

/**
 * @typedef {Object} CaptureDimensions
 * @property {number} width Width in pixels
 * @property {number} height Height in pixels
 */

/**
 * @typedef {Object} CaptureContext
 * Immutable snapshot of screen evidence captured by main process.
 * The full image buffer stays in the main process; the renderer receives
 * the lightweight preview Data URL and OCR text.
 * @property {string} id Unique capture identifier (UUID)
 * @property {string} sourceId Stable source identifier ('screen:default', 'window:123', etc.)
 * @property {string} name Human-readable label ('Entire Screen', 'VS Code', etc.)
 * @property {string} capturedAt ISO 8601 timestamp of capture
 * @property {string} preview Data URL thumbnail (640px wide max) for review
 * @property {CaptureDimensions} dimensions Captured image pixel dimensions
 * @property {string} text Extracted OCR text or image indicator
 * @property {CaptureQuality} quality OCR extraction quality metrics
 * @property {boolean} imageMode Whether screenshot image is passed directly to multimodal vision
 * @property {string} [image] Base64-encoded PNG image (main process private field)
 */

/**
 * @typedef {Object} ProviderSnapshot
 * Immutable snapshot of provider configuration at the moment an AnswerRequest is issued.
 * Prevents in-flight requests from being corrupted by simultaneous settings changes.
 * Contains no credentials or secrets in client-visible metadata.
 * @property {string} provider AI provider identifier ('ollama', 'openai', 'anthropic', 'gemini', 'compatible')
 * @property {string} model Selected model identifier (e.g. 'qwen3:1.7b', 'gpt-4o')
 * @property {string} [baseURL] Custom endpoint URL for compatible providers
 * @property {boolean} [reasoning] Whether extended reasoning mode is active
 * @property {boolean} [sendImage] Whether image is transmitted to multimodal vision
 */

/**
 * @typedef {Object} AnswerRequest
 * Scoped request for an AI answer.
 * @property {string} requestId Unique request identifier (UUID)
 * @property {string} sessionId Stable session identifier (keyed by sourceId)
 * @property {string} contextId Reference to the CaptureContext.id used for evidence
 * @property {string} question User question or voice transcript
 * @property {AssistantIntent} intent Assistant intent / mode
 * @property {ProviderSnapshot} providerSnapshot Snapshot of provider config
 * @property {string} timestamp ISO 8601 timestamp of request initiation
 */

/**
 * @typedef {Object} AnswerStartedEvent
 * @property {'started'} type
 * @property {string} requestId Scoped request UUID
 * @property {string} [capturedAt] ISO 8601 timestamp of evidence capture
 */

/**
 * @typedef {Object} AnswerDeltaEvent
 * @property {'delta'} type
 * @property {string} requestId Scoped request UUID
 * @property {string} delta Incremental text chunk emitted during streaming
 */

/**
 * @typedef {Object} AnswerDoneEvent
 * @property {'done'} type
 * @property {string} requestId Scoped request UUID
 * @property {number} turn Multi-turn conversation counter (1-indexed)
 * @property {string} answer Full normalized answer text in Markdown format
 * @property {string[]} [warnings] Optional quality or token-cutoff warnings
 */

/**
 * @typedef {Object} AnswerCanceledEvent
 * @property {'canceled'} type
 * @property {string} requestId Scoped request UUID
 */

/**
 * @typedef {Object} AnswerErrorEvent
 * @property {'error'} type
 * @property {string} requestId Scoped request UUID
 * @property {string} message User-facing error message
 * @property {string} [recoveryAction] Suggested recovery action ('retry', 'check-settings', 'start-ollama')
 */

/**
 * @typedef {AnswerStartedEvent | AnswerDeltaEvent | AnswerDoneEvent | AnswerCanceledEvent | AnswerErrorEvent} AnswerEvent
 */

/**
 * @typedef {Object} VoiceResult
 * Result of a completed or canceled audio recording session.
 * @property {string} recordingId Unique recording session UUID
 * @property {string} transcript Transcribed speech text
 * @property {number} durationSec Duration of recording in seconds
 * @property {'completed' | 'canceled' | 'error'} status Final state
 * @property {string} [error] Error message if status is 'error'
 */

/**
 * @typedef {Object} ProviderCapabilities
 * Metadata describing an AI provider's supported features.
 * Contains no credentials.
 * @property {string} provider Provider identifier
 * @property {string} label User-facing display name
 * @property {boolean} supportsVision Supports screenshot image input
 * @property {boolean} supportsReasoning Supports extended reasoning / thinking parameters
 * @property {boolean} supportsStreaming Supports chunked token streaming
 * @property {boolean} requiresKey Requires API key credential
 * @property {boolean} requiresBaseURL Requires custom endpoint URL
 * @property {boolean} isLocal Runs locally on user's machine (no network egress)
 */

const PROVIDER_CAPABILITIES = Object.freeze({
  ollama: {
    provider: 'ollama',
    label: 'Ollama · local models',
    supportsVision: true,
    supportsReasoning: true,
    supportsStreaming: true,
    requiresKey: false,
    requiresBaseURL: false,
    isLocal: true
  },
  openai: {
    provider: 'openai',
    label: 'OpenAI',
    supportsVision: true,
    supportsReasoning: true,
    supportsStreaming: true,
    requiresKey: true,
    requiresBaseURL: false,
    isLocal: false
  },
  anthropic: {
    provider: 'anthropic',
    label: 'Anthropic',
    supportsVision: true,
    supportsReasoning: true,
    supportsStreaming: true,
    requiresKey: true,
    requiresBaseURL: false,
    isLocal: false
  },
  gemini: {
    provider: 'gemini',
    label: 'Gemini',
    supportsVision: true,
    supportsReasoning: true,
    supportsStreaming: true,
    requiresKey: true,
    requiresBaseURL: false,
    isLocal: false
  },
  compatible: {
    provider: 'compatible',
    label: 'OpenAI-compatible API',
    supportsVision: true,
    supportsReasoning: false,
    supportsStreaming: true,
    requiresKey: false,
    requiresBaseURL: true,
    isLocal: false
  }
});

const INTENT_TO_MODE = Object.freeze({
  explain: 'general',
  hint: 'dsa',
  debug: 'debug',
  meeting: 'meeting'
});

const MODE_TO_INTENT = Object.freeze({
  general: 'explain',
  dsa: 'hint',
  debug: 'debug',
  meeting: 'meeting'
});

/**
 * Validates that an object conforms to CaptureContext contract.
 * @param {any} input
 * @returns {CaptureContext}
 */
function validateCaptureContext(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid CaptureContext: object expected.');
  if (typeof input.id !== 'string' || !input.id) throw new Error('CaptureContext requires string id.');
  if (typeof input.sourceId !== 'string' || !input.sourceId) throw new Error('CaptureContext requires string sourceId.');
  if (typeof input.name !== 'string') throw new Error('CaptureContext requires string name.');
  if (typeof input.capturedAt !== 'string') throw new Error('CaptureContext requires string capturedAt timestamp.');
  if (typeof input.preview !== 'string') throw new Error('CaptureContext requires preview data URL.');
  if (!input.dimensions || typeof input.dimensions.width !== 'number' || typeof input.dimensions.height !== 'number') {
    throw new Error('CaptureContext requires numeric dimensions { width, height }.');
  }
  if (typeof input.text !== 'string') throw new Error('CaptureContext requires text.');
  if (!input.quality || typeof input.quality.confidence !== 'number' || typeof input.quality.truncated !== 'boolean') {
    throw new Error('CaptureContext requires quality { confidence, truncated }.');
  }
  return input;
}

/**
 * Validates that an object conforms to AnswerEvent contract.
 * @param {any} event
 * @returns {AnswerEvent}
 */
function validateAnswerEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Invalid AnswerEvent: object expected.');
  if (typeof event.requestId !== 'string' || !event.requestId) throw new Error('AnswerEvent requires requestId.');
  const validTypes = ['started', 'delta', 'done', 'canceled', 'error'];
  if (!validTypes.includes(event.type)) throw new Error(`Unknown AnswerEvent type: ${event.type}`);

  if (event.type === 'delta') {
    if (typeof event.delta !== 'string') throw new Error('AnswerDeltaEvent requires string delta.');
  } else if (event.type === 'done') {
    if (typeof event.turn !== 'number' || event.turn < 1) throw new Error('AnswerDoneEvent requires positive integer turn.');
    if (typeof event.answer !== 'string') throw new Error('AnswerDoneEvent requires string answer.');
    if (event.warnings && !Array.isArray(event.warnings)) throw new Error('AnswerDoneEvent warnings must be an array.');
  } else if (event.type === 'error') {
    if (typeof event.message !== 'string') throw new Error('AnswerErrorEvent requires string message.');
  }
  return event;
}

/**
 * Validates that an object conforms to VoiceResult contract.
 * @param {any} input
 * @returns {VoiceResult}
 */
function validateVoiceResult(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid VoiceResult: object expected.');
  if (typeof input.recordingId !== 'string' || !input.recordingId) throw new Error('VoiceResult requires recordingId.');
  if (typeof input.transcript !== 'string') throw new Error('VoiceResult requires string transcript.');
  if (typeof input.durationSec !== 'number') throw new Error('VoiceResult requires numeric durationSec.');
  if (!['completed', 'canceled', 'error'].includes(input.status)) throw new Error('Invalid VoiceResult status.');
  return input;
}

module.exports = {
  PROVIDER_CAPABILITIES,
  INTENT_TO_MODE,
  MODE_TO_INTENT,
  validateCaptureContext,
  validateAnswerEvent,
  validateVoiceResult
};
