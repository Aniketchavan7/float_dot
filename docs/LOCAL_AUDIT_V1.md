# Float Dot — implementation audit

Audited 8 October 2026 against PRD v1.2. **Development prototype; MVP acceptance is not complete.**

## Verified in this audit

- 24 automated tests pass, including new meeting cancellation, transcript preservation, queued transcription, microphone release, timestamps, and preference validation regressions.
- Electron smoke passes: secure app origin/preload, synthetic AudioWorklet input, selected-window capture and OCR (95 confidence on the synthetic fixture). This is not live-microphone or OCR correctness certification.
- Local readiness confirms OCR, Whisper assets and Qwen3 4B are installed on an i7-12700H / 16 GB machine. Model digest: `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`.
- `npm run pack` produced an unpacked Windows application. Building a directory is not proof of a working portable executable outside the checkout.

## Corrections made

- Stop/collapse/mode changes release meeting recording and preserve its transcript; only explicit Clear deletes it. Failed microphone startup restores controls.
- Summary output is request-scoped; canceled summaries cannot overwrite a later answer. Summary waits for accepted transcription chunks.
- Recording flush scheduling no longer waits for ASR before scheduling the next chunk, which could exceed the encoder's 30-second limit and lose audio. Stop releases microphone tracks before waiting for transcription. Timestamps identify the beginning of each chunk.
- Added visible summary Stop, transcript segment deletion, recording-safe read-aloud, bounded queued audio, validated meeting timestamps/source and summary inputs.
- Added capture crop fields with explicit recapture, microphone preference, configurable shortcut with conflict errors, and tray access.
- Evaluation defaults to all 30 corrected-text cases; `--sample` explicitly selects three. Full responses and model digest are saved for human review. Keyword matches are labeled heuristics, not quality passes.
- Model output-limit termination is an error, not a successful answer. Non-thinking Qwen instruction is included in addition to the API flag; local answer quality remains under investigation.

## PRD alignment and remaining acceptance gaps

| Requirements | Evidence / remaining work |
| --- | --- |
| FR-01 onboarding | Readiness and setup scripts exist. In-app download progress/cancel/retry, disk estimates and guided microphone/model tests remain incomplete. |
| FR-02 dot / FR-14 settings | Dot/card, tray, monitor-removal recovery, configurable shortcut, model/mic/theme preferences implemented. Mixed-DPI recovery, shortcut conflicts and accessibility need hands-on validation. |
| FR-03–08 capture/voice/answer | Explicit source, preview, crop recapture, transcript correction, local OCR/ASR and sanitized streaming implemented. Real speech/accent/noise and difficult code OCR gates remain open. |
| FR-09–10 modes | Prompted hints/debug/general exist. Prompts and keyword checks do not establish answer correctness or prevent every solution leak. |
| FR-11–12 context/cancel | Bounded context, cancellation and stale-output tests pass. Ten consecutive real requests and worker-stop timing remain unverified. |
| FR-13 offline | Fixed loopback endpoint and local model allowlist exist. Disconnected operation and content-egress observation have not been demonstrated. |
| FR-15 data | In-memory sessions, clear and explicit exports exist. There is no retained-session database. |
| FR-16 failures | Error handling implemented; full missing-device/worker-crash/timeout matrix remains open. |
| FR-17–18 usability | Local-service voice filter and reviewed exports implemented. Actual offline OS speech and usability testing remain open. |
| FR-19–22 later scope | Meeting microphone experiment exists ahead of the planned core gates. Call audio, vision, browser extension and searchable memory remain later work. |
| NFR release gates | Thirty-case human rubric, end-to-end warm median/p95, memory/CPU report, live microphone, offline/egress, keyboard/screen-reader, and packaged external-run evidence are not complete. |

The previous claim that FD-001 through FD-015 were fully verified was too strong. Three text-only keyword matches cannot satisfy the 30-case screen-and-voice quality gate. Early live cases in this audit produced lengthy reasoning-style text rather than concise answers; therefore answer quality is a release blocker.

## Live inference finding

The three representative cases were rerun after enabling the non-thinking hint: **0/3 completed successfully**; all reached the 512-token output limit. Simple chat, assistant-prefill and raw-template probes also produced reasoning-style text on the installed model/runtime. No local runtime settings or model weights were changed. A compatible verified model/runtime configuration is still required before the core can be called useful. The non-thinking hint follows [Qwen's official guidance](https://qwenlm.github.io/blog/qwen3/), but it did not fix this installed runtime. Failed answers now remain errors instead of counting as quality passes.

A separate explicit **Slower reasoning compatibility mode** is available in settings (off by default). It discards the runtime's thinking stream and budgets up to 2,048 tokens within the existing two-minute timeout. This is an experimental compatibility path, not a change to the MVP performance gate. Regression tests verify that only final-answer content reaches the renderer.

Compatibility-mode diagnostic results: DSA Two Sum timed out at 120 seconds; Debug returned a final answer after 67.1 seconds (79.2 seconds total); Explain returned final text after 29.4 seconds (39.0 seconds total). The two completed answers matched keyword checks and were inspected for their use of the supplied excerpt, but this three-case run does not establish a quality-gate pass. Both measured first-answer times exceed the proposed 15-second median target. Full final responses are in the ignored local file `.artifacts/evaluation-report.json`. No full 30-case run was completed after these failures.
