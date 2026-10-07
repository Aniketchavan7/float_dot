# Float Dot implementation backlog

All tasks are unstarted. Order is dependency-driven. P0 builds the core; P1 completes tester readiness; P2 expands only after evidence supports it.

## P0: prove and build the core

- [ ] **FD-001 — Audit and pin upstream.** Record commit/hash, license/NOTICE files, asset provenance, dependencies, scripts, capture code, IPC, renderer permissions, and remote calls. Decide which modules to reuse. Deliver an audit note; do not run setup scripts before reviewing them.
- [ ] **FD-002 — Hardware and local-model spike.** Record CPU/RAM/GPU with an available method, benchmark the proposed text model and a smaller alternative, and set context/output limits. Deliver cold/warm timing and memory results. Depends on FD-001 for any reused code.
- [ ] **FD-003 — ASR spike.** Record five short technical questions, convert audio locally, transcribe with whisper.cpp, and measure errors/latency. Missing microphone/model must return a useful error. May run independently of FD-002 after dependency review.
- [ ] **FD-004 — OCR spike.** Evaluate ten selected-window text/code screenshots with known text; identify punctuation/indentation failures and the need for cropping. Deliver fixtures and findings.
- [ ] **FD-005 — Local provider adapter.** Implement readiness and streamed answers against a configured loopback endpoint using local models. Bound timeouts, support cancellation, and prohibit silent cloud fallback. Depends on FD-002.
- [ ] **FD-006 — One-shot pipeline.** Join voice + screenshot + OCR + prompt + local model. Use synthetic fixtures first; attach source/time to every request. Deliver three end-to-end demonstrations. Depends on FD-003/004/005.
- [ ] **FD-007 — Dot and answer card.** Add draggable/collapsible UI, source label, capture preview, keyboard access, configurable shortcut, visible states, and Stop. Keep panel on-screen after monitor changes. Depends on FD-006.
- [ ] **FD-008 — Reliable capture and recording lifecycle.** Select a window, exclude our UI from its snapshot, handle tab changes/closed windows/DPI, cap recording, release microphone after stop, and remove temporary media. Depends on FD-007.
- [ ] **FD-009 — Request coordinator.** One active request, unique request IDs, bounded queue/context, propagated cancellation, stale-event rejection, and recoverable worker errors. Rapid start/stop cannot mix answers between requests. Depends on FD-008.
- [ ] **FD-010 — DSA/debug modes.** Version prompts, enforce hint progression, ground explanations in capture text, surface missing information, and include useful follow-ups. Depends on FD-009.

## P1: ship a usable free tester version

- [ ] **FD-011 — Local onboarding.** Detect dependencies/models, show download sizes and progress, allow retry, avoid bundled paid keys, and provide a microphone/model test. App remains usable for a typed diagnostic input if mic is unavailable. Depends on FD-010.
- [ ] **FD-012 — Renderer and data boundaries.** Narrow validated IPC, isolated renderer, sanitized Markdown, navigation restrictions, safe process invocation, redacted logs, optional local history, delete/export controls, and crash cleanup. Implement alongside P0; final audit after FD-011.
- [ ] **FD-013 — Optional spoken answers.** Use available installed OS voice, show unavailable-voice fallback, prevent recording the assistant's own output, and interrupt playback. Depends on FD-009.
- [ ] **FD-014 — Quality/performance gate.** Run the 30-case corpus, cancellation/missing-dependency cases, offline/network checks, and reference-machine latency measurement. Publish actual results and supported limits. Depends on FD-010/012.
- [ ] **FD-015 — Windows portable build.** Use platform-compatible scripts, pin supported runtime/dependencies, package required notices, document model installation, and smoke-test outside the checkout. Depends on FD-011/014.
- [ ] **FD-016 — Tester kit.** Create synthetic demo assets, a short setup guide, known issues, a feedback form/list, and a 60-second demonstration script. Depends on FD-015.
- [ ] **FD-017 — First paid pilot.** Identify repeat users, show a concrete workflow/setup deliverable, agree scope/support, test proposed pricing, and record actual sales/declines/support time. Depends on FD-016 and repeat-use evidence. Human outreach is a launch task, not an automated message action.

## P2: expand when the core is useful

- [ ] **FD-018 — Vision experiment.** Benchmark an image-capable local model on charts/diagrams, review model terms, and compare against OCR. Offer only on measured hardware profiles.
- [ ] **FD-019 — Meeting microphone mode.** Explicit recording lifecycle, rolling timestamped transcript, bounded retention, transcript-backed summaries, pause/delete, and evaluation with synthetic meeting audio.
- [ ] **FD-020 — Windows call-audio capture.** Evaluate maintained loopback approaches, headphones/device switching, clipping, and synchronization. Advertise remote-speaker capture only after FD-019/020 pass.
- [ ] **FD-021 — Meeting workflow pack.** Build reviewed action-item/decision exports after reliable transcription. Benchmark incorrect or missing attribution before making speaker claims.
- [ ] **FD-022 — Browser extension.** User-enabled per-tab page text, scoped permissions, explicit connection to the desktop app, and tab/frame identity checks. Defer autonomous navigation/actions.
- [ ] **FD-023 — Searchable local memory.** Opt-in persistence, retention/deletion, versioned migrations, and grounded recall. Introduce SQLite only when file-based history is insufficient.
- [ ] **FD-024 — Billing/team features.** Build only after real paid pilots justify it; budget fees, signing, support, and any server expense separately from the free core.

## First release definition

FD-001 through FD-012 and FD-014 through FD-016 complete; optional spoken output may follow. A tester can install, select a window, ask through the mic, receive a useful grounded answer, cancel, and repeat locally without paid keys. Actual limitations, licenses, hardware profile, and evaluation results are documented.
