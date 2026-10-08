# Float Dot Build & Verification Status

Updated: 8 October 2026. Version: 0.1.0 development prototype.

---

## 1. Verified & Passing Automated Tests

- **17/17 tests pass (`npm test`)**:
  - `core.test.cjs`: input boundaries, WAV encoder/resampling, corrupted/concurrent settings, cancellation/stale chunks, context separation, prompt boundaries, streamed-response parsing, local-model filtering.
  - `meeting.test.cjs`: meeting mode validation in settings and contracts, meeting prompt constraints (citations, decisions vs. proposals, no invented owners/deadlines), timestamp formatting, MeetingService lifecycle (start/pause/resume/stop/clear), audio chunk queuing and segment extraction, markdown export with metadata and citations, structured summary prompt generation.
  - `eval.test.cjs`: complete 30-case evaluation corpus validation (10 DSA, 10 Debug, 10 General documentation cases) ensuring rubric compliance, hintLevel=0 solution hiding, and structured root-cause prompts.
- **Automated Smoke Test (`npm run smoke`)**:
  - AudioWorklet audio pipeline smoke test (`AUDIO_WORKLET_SMOKE_OK`).
  - Native window capture & OCR extraction smoke test (`WINDOW_CAPTURE_OCR_SMOKE_OK`).
  - Electron window initialization & security sandbox smoke test (`ELECTRON_SMOKE_OK`).
- **Audio & Speech Pipeline Verification (`npm run test:audio`)**:
  - Whisper binary detection (`whisper-cli.exe` and `ggml-base.bin`).
  - Synthetic 16kHz mono WAV tone processing in 3,206ms without false-positive silence crash.
- **Live AI Evaluation Benchmarks (`npm run test:eval`)**:
  - Evaluated against local Ollama (`qwen3:4b`) running on Intel i7-12700H:
    - `[dsa-01] DSA: Two Sum`: PASS (TTFB: 8,541 ms cold, Total: 43,865 ms) — conceptual guidance provided without revealing solution code.
    - `[debug-11] DEBUG: Cannot read properties of undefined`: PASS (TTFB: 1,029 ms warm, Total: 34,812 ms) — structured Observed / Likely cause / Next check.
    - `[general-21] GENERAL: useEffect Cleanup`: PASS (TTFB: 930 ms warm, Total: 35,443 ms) — concise explanation of cleanup lifecycle.

---

## 2. Packaging Verification (`npm run pack`)

- **Electron Builder packaging succeeded** (`electron-builder --dir`):
  - Output directory: `dist\win-unpacked\Float Dot.exe`
  - Extra resources mapped `.models` -> `dist\win-unpacked\resources\models`.
  - In-place detection of packaged Whisper executable and Tesseract data in `process.resourcesPath/models`.

---

## 3. Features Implemented

### Core Features (P0)
- **Floating Dot & Card Window**: Always-on-top, draggable, collapsible dot (`84×84`) and expandable answer panel (`480×820`), with auto-hide and monitor repositioning.
- **Window Capture & Crop**: Electron `desktopCapturer` targeting explicit window sources at 2400×1800 with self-window exclusion.
- **AudioWorklet & PCM16 Encoding**: In-renderer float downmixing, resampling to 16 kHz mono PCM16 WAV, 30-second question cap, energy thresholding.
- **Local OCR**: Tesseract.js worker with `PSM.AUTO` and English fast trained data, layout preservation, 12,000-char truncation check.
- **Local LLM Streaming**: Ollama loopback streaming adapter (`127.0.0.1:11434`), strictly regex-limited to local Qwen3 tags, prompt injection defense.
- **Three Core Modes**:
  - *DSA Hints*: Conceptual nudge on hint 1, no solution code without explicit request, tracks progressive hint levels.
  - *Debug*: Structured Observed -> Likely cause -> Next check. Commands as suggestions only.
  - *General*: Contextual explanations and code walkthroughs.
- **Request Coordinator**: Single active request, UUID scoping, AbortController cancellation, stale-chunk suppression, memory-bounded 4-message conversation history.

### Meeting Mode (FD-019, FD-021)
- **Meeting Workspace & Consent**: Notice regarding room microphone vs. loopback capture.
- **Rolling Audio & Transcription**: `MeetingRecorder` AudioWorklet continuously accumulating and flushing 10-second audio slices; `TranscriptionService.transcribeSegment()` converts speech to timestamped text without false-alarm silence errors.
- **Live Timestamped Transcript**: Real-time rendering of `[MM:SS]` segments in UI with auto-scroll and segment deletion.
- **Meeting Intelligence Prompts**: Specialized prompt extracting Executive Summary, Key Decisions (distinguished from Proposals), Action Items with exact timestamp citations (never inventing owners/deadlines), and Open Questions.
- **Markdown Export**: Direct file save dialog exporting structured meeting notes and complete timestamped transcript.

### Evaluation Suite (FD-014)
- **30-Case Benchmark Corpus (`tests/fixtures/eval-corpus.json`)**:
  - 10 DSA cases with forbidden solution patterns and required conceptual keywords.
  - 10 Debugging cases across common runtime errors (CORS, undefined map, memory leaks, merge conflicts).
  - 10 Documentation explanation cases (React, TypeScript, Rust, Node event loop).
- **Evaluation Runner (`scripts/run-eval.cjs`)**: Live automated testing against local Ollama.
