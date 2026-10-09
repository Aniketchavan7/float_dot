# Float Dot backlog

Current scope: PRD v2.0, floating desktop assistant with user-selected AI.

## Shipping modules — current delivery priority

Use [the shipping plan](docs/SHIPPING_PLAN.md) for scope, owners, estimates and acceptance. Completed prototype items below are historical capabilities, not closed release modules.

- [ ] M00 — Contracts and release scope.
- [ ] M01 — Minimal overlay UI (suggested Aniket ownership).
- [ ] M02 — Native window placement, focus and recovery.
- [ ] M03 — Reliable capture and evidence.
- [ ] M04 — Voice input.
- [ ] M05 — Prompt/context/answer quality.
- [ ] M06 — Provider compatibility and live verification.
- [ ] M07 — Onboarding and settings (suggested Aniket ownership).
- [ ] M08 — Reliability, privacy and performance.
- [ ] M09 — Installer and distribution.
- [ ] M10 — Pilot and launch (suggested Aniket ownership).

## Prototype capabilities and previous verification

- [x] Add OpenAI, Anthropic, Gemini and OpenAI-compatible adapters alongside Ollama.
- [x] Remove Qwen-only local model restriction.
- [x] Add OS-encrypted API-key save/remove and endpoint isolation.
- [x] Add the desktop dot and collapse/reopen controls. Current startup still opens the large panel; M02 must correct this.
- [x] Add explicit display capture and screenshot file/clipboard inputs.
- [x] Add optional direct image input; retain local OCR text mode.
- [x] Show actual provider/model/destination; remove universal local-processing claims.
- [x] Add adapter contract tests and native screenshot-to-test-API smoke.
- [x] Validate real usage: 10 consecutive requests, rapid cancellation, burst suppression, and follow-ups.
- [x] Run 30-case local text-fixture screening (qwen3:1.7b: 28/30 keyword/format checks, 210ms median provider first-token latency).
- [ ] Complete manual correctness and hint-spoiler review across supported model choices; current small-model results contain factual errors.
- [ ] Run live API-provider tests with configured accounts and chosen models.
- [ ] Validate actual desktop imports, multi-display/DPI, microphone and keyboard journeys.
- [ ] Polish onboarding and capture/crop usability.
- [ ] Validate packaged app outside the checkout; ship notices and tester kit.
- [ ] Pilot with five users and collect repeat-use evidence.
- [ ] Offer paid setup/workflow customization only after useful outcomes are demonstrated.

Meeting microphone mode remains experimental. Call audio, browser extension, searchable history and team billing are separate later work.
