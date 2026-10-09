# M00 — Contracts and scope

**Owner:** together · **Estimate:** 1–2 days · **Dependencies:** none

Outcome: other modules can be developed against fixtures without editing the same orchestration code.

Entry files: `src/main/index.js`, `src/preload/index.js`, `src/renderer/app.js`, `src/shared/validation.js`, `PRD.md`.

- [x] Freeze the Windows v1 journey, minimal UI states and deferred scope from the shipping plan (see `docs/STATE_TRANSITIONS.md`).
- [x] Define JSDoc contracts for CaptureContext, AnswerRequest/Event, VoiceResult and ProviderCapabilities in proposed `src/shared/contracts.js`.
- [x] Add fixtures for idle, recording, capturing, answering, completion, incomplete output and recoverable failures in `tests/fixtures/contract-fixtures.json`.
- [x] Agree immutable provider/model snapshots per request, cancellation IDs, context freshness and session reset rules (tested in `tests/contracts.test.cjs`).
- [x] Assign integration ownership for main, preload and renderer entry points; extract files incrementally rather than rewriting the app.

**Complete when:** M01 renders all fixtures without a live API; service tests consume the same event shapes; each later module has an owner and known integration boundary. Every asynchronous event carries the relevant request ID, and stale events cannot change the current state.

**Status:** Completed (9 Oct 2026). Handed off `src/shared/contracts.js`, `tests/fixtures/contract-fixtures.json`, `scripts/fixture-runner.cjs`, and `docs/STATE_TRANSITIONS.md`. All 52 tests passing. Ready for M01.
