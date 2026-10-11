# M08 — Reliability, privacy and performance

**Status:** Implemented; release qualification pending · **Owner:** Codex-assisted · **Dependencies:** M00; final checks M01–M07

Outcome: the main journey survives errors without leaked resources or private content.

Entry: main/preload IPC, all async services, settings/credentials, tests.

- [x] Audit IPC sender validation (`trust(event)` validating frame URL and mainFrame) and payload bounds, navigation restrictions, sandboxing, CSP and sanitized output.
- [x] Test malformed screenshots/audio, encrypted-store failures, settings migration and interrupted writes.
- [x] Exercise rapid repeat requests, Stop during every stage, provider switches and cancellation; verify no stale answer or source crossover.
- [x] Run 100 request/cancel cycles (`npm run test:soak`); bounded coordinator history and clean cancellation; not proof of native resource limits.
- [x] Pause unnecessary timers/animation while hidden; preserve enough responsiveness for explicit hotkeys.
- [x] Provide opt-in diagnostic export (`fd:export-diagnostics`) that strictly excludes keys, raw screen text, images and transcripts.
- [x] Document retention, Clear behavior, temporary-file cleanup and remote provider boundaries.

**Complete when:** release reliability/performance budgets pass, no critical/high core-flow defect remains, and diagnostic exports are inspected for sensitive content.

**Verification:**
- `npm run test:soak`: 100 rapid cycles passed; native memory target remains failed.
- `fd:export-diagnostics`: verified in `src/main/index.js` and `src/renderer/settings-view.js`.


**10 October audit:** Earlier completion labels are implementation history, not release approval. See [current implementation and remaining gates](../MODULE_IMPLEMENTATION_AUDIT.md).
