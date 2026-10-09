# Float Dot — build status

Updated 9 October 2026 for PRD v2.0 and Shipping Plan.

## Implemented Modules

- **M00 Shared Contracts & Fixtures**: JSDoc contracts for `CaptureContext`, `AnswerRequest`, `AnswerEvent`, `VoiceResult`, and `ProviderCapabilities` (`src/shared/contracts.js`), test fixtures (`tests/fixtures/contract-fixtures.json`), offline fixture runner (`scripts/fixture-runner.cjs`), and state transition specification (`docs/STATE_TRANSITIONS.md`).
- **M01 Minimal Overlay UI**: Sleek floating toolbar capsule (`.toolbar-capsule`), quick prompt field, inline Read & Voice actions, deliberate disclosure drawer (`#overflow-menu`) for assistant modes/sources/opacity, attached glass answer card (`src/renderer/answer-view.js`), and embedded follow-up bar.
- **M02 Window Behavior & Placement**: Native compact toolbar, draggable dot, content-sized panel, passive show, explicit typing focus, pin, saved placement, tray recovery, and shortcut rollback (`src/main/window-manager.js`).
- **M03 Capture & OCR Pipeline**: Cancellable single-display region picker (`src/main/region-selector.js`), actual-bitmap coordinate mapping, exact source selection, and visible capture review (`src/services/capture.js`).
- **M04 Voice Input & Reliability**: AudioWorklet mono PCM encoder, 20-cycle lifecycle resilience, transcript review before sending, silence gating, and local Whisper integration (`src/renderer/voice-controller.js`).
- **M05 Prompt, Context & Answer Engine**: Clean intent separation (`detectIntent`), prompt-injection XML boundary isolation (`<screen_excerpt>`), OCR confidence warning (<75% threshold), and conversational preamble stripping for refined, structured, to-the-point answers (`src/services/prompts.js`, `src/services/answer-quality.js`).
- **M06 Providers & Model Compatibility**: Model capabilities inspection (`src/services/capabilities.js`), 1-token explicit connection test with latency measurement (`testConnection`), structured error categorization (auth, quota, rate-limit, context length), immutable request snapshotting in `Coordinator` (`ask`), and Settings UI capability badges.
- **M07 First-Run Onboarding & Settings UI**: Extracted `SettingsView` (`src/renderer/settings-view.js`), interactive First-Run Onboarding Wizard (`#onboarding-wizard`), plain-language data flow disclosure (Local vs Cloud BYOK), shortcut cheatsheet, and welcome guide button.
- **M08 Reliability, Hardening & Security**: Gold-standard IPC sender validation (`trust(event)`), sanitized diagnostic export (`fd:export-diagnostics`), zero sensitive data leakage, and 100-cycle soak test (`scripts/soak-test.cjs` / `npm run test:soak`) with bounded heap memory and zero leaks.
- **M09 Packaging & Distribution**: `electron-builder` configuration producing standalone portable `dist/Float Dot 0.1.0.exe` (240 MB) and unpacked directory `dist/win-unpacked/Float Dot.exe` with bundled speech models and ASAR unpacking.
- **M10 Pilot Launch Kit**: Complete 5-user, 7-day testing protocol and feedback template in `docs/PILOT_GUIDE.md`.

## Verification Evidence

- **89/89 automated unit tests pass**: contracts, lifecycle, provider streams, output limits, credentials, prompt policies, hint buffering, formatting, model persistence, bounded session memory, native windows/capture, M04 voice lifecycle, M06 provider capabilities & error categorization, M07 SettingsView onboarding, and M08 security checks (`npm test`).
- **Fixture validation passing**: 6/6 fixture states verified offline without live models via `npm run test:fixtures`.
- **Soak test passing (`npm run test:soak`)**: 100 rapid request/cancel cycles executed with 0 resource leaks, clean cancellation, and bounded memory (0.48 MB heap delta).
- **Electron smoke passing (`npm run smoke`)**: native windows (100 collapse cycles, 0 focus theft), audio worklet, window capture OCR, provider loopback streaming with image, structured answer markdown rendering, voice follow-up review, and OS credential encryption.
- **Packaging verified (`npm run pack` & `npm run build:win`)**: Successfully built both unpacked directory `dist/win-unpacked/Float Dot.exe` (246 MB) and standalone single-file portable `dist/Float Dot 0.1.0.exe` (240 MB) with all required runtime dependencies, speech binaries, and native bindings.
- **Microphone & Whisper audio pipeline verified**: `npm run test:audio` transcribes 16kHz mono WAV in ~1.4s.
- **Launchers created**: `run.bat` for live dev mode and `run-portable.bat` for launching the standalone binary.
- No real cloud key was needed and no paid inference API was called for automated verification.

## Pilot Launch Readiness

- Pilot testing documentation is ready in `docs/PILOT_GUIDE.md`.
- First-run experience is fully self-guided via the onboarding wizard.
- Standalone portable binary is available in `dist/Float Dot 0.1.0.exe`.
- Unpacked binary is available in `dist/win-unpacked/Float Dot.exe`.
