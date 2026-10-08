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

- **32/32 automated tests pass**: prior lifecycle checks plus four streaming adapters, split UTF-8/SSE frames, text/image payload routing, canceled requests, missing/incomplete/error responses, endpoint validation, encrypted credential persistence and endpoint isolation.
- **Electron smoke passes**: secure renderer/preload, synthetic AudioWorklet WAV, native fixture-window capture and OCR (95 confidence), screenshot image routed through a loopback mock API to a streamed answer, and real OS encryption roundtrip.
- No real cloud key was needed and no paid inference API was called for these tests.

## Still unverified / remaining

- Live OpenAI/Anthropic/Gemini/custom-account behavior, supported model IDs, quotas and provider-specific image capabilities. Protocol tests are not live provider certification.
- Native file-picker/clipboard imports, display capture with multiple monitors/DPI, dot dragging, real microphone and offline OS voice need hands-on checks.
- Packaged application run outside the development checkout, onboarding polish, notices and tester kit.
- Full 30-case grounded-answer and latency gate for each supported configuration. The existing local Qwen benchmark remains slow; its failures do not prevent choosing another provider.
- The local-only audit is archived at [docs/LOCAL_AUDIT_V1.md](docs/LOCAL_AUDIT_V1.md). It is historical evidence rather than the current provider policy.

## Integration references

- [OpenAI streaming Responses](https://developers.openai.com/api/docs/guides/streaming-responses) and [image inputs](https://developers.openai.com/api/docs/guides/images-vision).
- [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming) and [vision](https://platform.claude.com/docs/en/build-with-claude/vision).
- [Gemini Generate Content](https://ai.google.dev/api/generate-content).
