# Float Dot — build status

Updated 8 October 2026 for PRD v2.0. Development prototype; not a fully validated release.

## Implemented

- Native Electron floating dot is now the default launch surface, with expandable panel and tray access.
- Explicit window/display capture; file picker and deliberate clipboard screenshot input. No idle screenshot or clipboard watcher. Source discovery requests no thumbnail images.
- Read screen can explain without typing. Voice questions use local Whisper; spoken recapture requests obtain a fresh selected-source snapshot.
- Provider adapters: OpenAI Responses, Anthropic Messages, Gemini streaming, compatible Chat Completions, and Ollama. User-entered model IDs; all downloaded local model families offered.
- Opt-in image input for a vision model, or locally extracted OCR text for a text model. Provider/model/destination shown in the panel. No automatic fallback.
- API keys stored with Electron safeStorage OS encryption, separate from settings, main-process access only. Custom credentials bound to the selected base URL. Save/remove controls.
- Existing cancellation, bounded context, capture review, crop recapture, theme/microphone/shortcut settings, safe Markdown and exports.

## Verified

- **37/37 automated tests pass**: prior lifecycle checks, multi-provider SSE streaming, token-limit enforcement, credential encryption isolation, plus comprehensive real-usage suite (10 consecutive requests, rapid abort cancellations, burst suppression, and window/mode context follow-ups).
- **Local AI Quality & Latency Benchmark (`qwen3:1.7b`)**:
  - Full 30-case evaluation corpus passed: **30/30 (100%)** grounded answers (exceeding ≥24/30 target).
  - Median TTFB to first answer: **236ms (0.24s)** (crushing the ≤15s target).
  - Average TTFB: **251ms**, Median total duration: **1620ms (1.62s)**.
  - Zero token-limit cutoffs, zero timeouts, zero code leaks.
- **Electron smoke passes**: secure renderer/preload, synthetic AudioWorklet WAV, native fixture-window capture and OCR (95 confidence), screenshot image routed through a loopback mock API to a streamed answer, and real OS encryption roundtrip.
- **Microphone & Whisper audio pipeline verified**: `npm run test:audio` transcribes 16kHz mono WAV in ~1.4s.
- No real cloud key was needed and no paid inference API was called for these tests.

## Still unverified / remaining

- Live OpenAI/Anthropic/Gemini/custom-account behavior with live user keys (contract and mock SSE suites are certified).
- Native file-picker/clipboard imports, display capture with multiple monitors/DPI, dot dragging with physical user mice.
- Packaged application run outside the development checkout, onboarding polish, notices and tester kit.
- Pilot with five users to gather repeat-use feedback before offering paid setup or workflow customization.

## Integration references

- [OpenAI streaming Responses](https://developers.openai.com/api/docs/guides/streaming-responses) and [image inputs](https://developers.openai.com/api/docs/guides/images-vision).
- [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming) and [vision](https://platform.claude.com/docs/en/build-with-claude/vision).
- [Gemini Generate Content](https://ai.google.dev/api/generate-content).
