# Float Dot implementation backlog

The core application prototype, meeting mode, speech verification, 30-case evaluation suite, and Windows portable packaging are implemented and verified. See [BUILD_STATUS.md](BUILD_STATUS.md) for actual test results and benchmark records.

## P0: prove and build the core

- [x] **FD-001 — Audit and pin upstream.** Reference pinned at `0a9da75135f5aade3a067d86a7c8bb73f372f014`; provenance recorded in `PROVENANCE.md`. Clean separation implemented without unreviewed upstream code.
- [x] **FD-002 — Hardware and local-model spike.** Tested on Windows 11 x64, Intel i7-12700H, RTX 3050 Ti Laptop GPU. `qwen3:4b` runs locally via Ollama with warm TTFB ~930ms–1029ms.
- [x] **FD-003 — ASR spike.** AudioWorklet recorder downmixes to 16 kHz mono PCM16 WAV. `whisper-cli.exe` integration completed with `transcribe` and `transcribeSegment`. Verified with `npm run test:audio`.
- [x] **FD-004 — OCR spike.** Tesseract.js worker with fast English trained data extracts text with layout preservation and truncation guarding.
- [x] **FD-005 — Local provider adapter.** Ollama loopback streaming adapter (`127.0.0.1:11434`), strictly regex-limited to local Qwen3 tags, prompt injection defense, and cancellation support.
- [x] **FD-006 — One-shot pipeline.** Full end-to-end integration: window capture + OCR + ASR + prompt assembly + local streaming answer.
- [x] **FD-007 — Dot and answer card.** Draggable/collapsible floating dot (`84×84`) and expandable answer panel (`480×820`), theme switching (system/light/dark), and auto-repositioning on monitor change.
- [x] **FD-008 — Reliable capture and recording lifecycle.** `desktopCapturer` targeting explicit window sources at 2400×1800 with self-window exclusion, crop validation, and temporary media cleanup.
- [x] **FD-009 — Request coordinator.** Single active request, UUID scoping, AbortController cancellation, stale-chunk suppression, memory-bounded 4-message conversation history.
- [x] **FD-010 — DSA/debug modes.** Versioned prompt registry in `src/services/prompts.js` supporting DSA hints (conceptual nudges without solution leaks), Debugging (structured cause & checks), and General explanations.

## P1: ship a usable free tester version

- [x] **FD-011 — Local onboarding.** Dependency readiness checks (`check-local.cjs`), status indicators in UI, and retryable setup scripts (`setup-local.cjs`).
- [x] **FD-012 — Renderer and data boundaries.** Sandboxed renderer, strict CSP, custom `floatdot://` protocol, IPC sender trust verification, and DOMPurify sanitization.
- [x] **FD-013 — Optional spoken answers.** Installed local OS speech synthesis integration with `localService` filter and interrupt controls in `src/renderer/app.js`.
- [x] **FD-014 — Quality/performance gate.** 30-case evaluation corpus in `tests/fixtures/eval-corpus.json` validated in `tests/eval.test.cjs` and live runner `scripts/run-eval.cjs` (3/3 representative live cases passing).
- [x] **FD-015 — Windows portable build.** Packaged via `electron-builder` (`npm run pack`), creating standalone distribution in `dist\win-unpacked\Float Dot.exe` with bundled Whisper CLI and OCR data in `resources\models`.
- [ ] **FD-016 — Tester kit.** Expanded public distribution zip, quick start video demo, and community feedback channels.
- [ ] **FD-017 — First paid pilot.** Prototype a reviewed workflow export, identify repeat users, show a concrete workflow deliverable, and record actual user feedback.

## P2: expand when the core is useful

- [ ] **FD-018 — Vision experiment.** Benchmark an image-capable local model on charts/diagrams, review model terms, and compare against OCR.
- [x] **FD-019 — Meeting microphone mode.** `MeetingRecorder` with 10s rolling chunk flush; `MeetingService` with state tracking, rolling timestamped transcript, deletion, and summary.
- [ ] **FD-020 — Windows call-audio capture.** Direct WASAPI loopback audio driver capture for headphones and remote meeting audio.
- [x] **FD-021 — Meeting workflow pack.** Action item and decision extractor prompts with exact timestamp citations and structured markdown export (`meeting-notes.md`).
- [ ] **FD-022 — Browser extension.** User-enabled per-tab page text, scoped permissions, and explicit connection to desktop app.
- [ ] **FD-023 — Searchable local memory.** Opt-in persistence, retention/deletion, and versioned migrations using SQLite when file-based history is insufficient.
- [ ] **FD-024 — Billing/team features.** Build only after real paid pilots justify it; budget fees, signing, support, and server expense separately from free core.

## First release status

FD-001 through FD-015, FD-019, and FD-021 are implemented and verified with 17 automated tests, smoke tests, audio tests, and live Ollama benchmarks.
