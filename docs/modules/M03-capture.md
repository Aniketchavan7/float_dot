# M03 — Screen capture and evidence

**Suggested owner:** Codex-assisted · **Estimate:** 3–5 days · **Dependencies:** M00; integrate M02

Outcome: the model receives the screen content the user actually intended.

**9 October implementation:** built; automated/native smoke verified. Physical capture matrix and arbitrary cloud model capability validation remain open. See [verification and API handoff](../M02_M03_VERIFICATION.md).

Entry: capture/preparation IPC in `src/main/index.js`, `src/services/ocr.js`, renderer capture review. Proposed boundary: `src/services/capture.js`.

- [x] Preserve window/display/file/clipboard inputs and explicit source selection; detect unavailable sources without falling back silently.
- [x] Add a single-monitor region selector and labeled monitor sources; map DIP coordinates to actual bitmap pixels.
- [x] Hide both app windows during capture; serialize captures and restore passively, respecting later hide/collapse commands.
- [x] Show thumbnail, source, timestamp, quality warnings and optional review. Fix preview being hidden inside the answer card before confirmation.
- [ ] Complete capability validation for arbitrary cloud/custom models (M06 integration). OCR/image routing and known Ollama vision rejection are implemented; unknown API model capabilities remain provider-validated.
- [x] Give imported screenshots distinct sessions; fresh captures replace evidence and follow-ups identify reused evidence.

**Complete when:** test all four inputs, 100–200% scaling, missing windows, canceling snip, blank images, low-resolution text and long code. Crops align with the selection; cancel sends nothing; no self-overlay contamination in declared supported capture modes.

**Handoff:** fixture screenshots, expected regions/text, physical capture matrix, and CaptureContext examples. No continuous screen watcher.
