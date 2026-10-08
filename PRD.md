# Float Dot — Product Requirements Document

Version: 1.2 · Date: 8 October 2026 · Owner: Aniket · Stage: initial prototype

This PRD defines the proposed product and acceptance criteria. It is not a description of an implemented application. It is authoritative for product requirements; [PLAN.md](PLAN.md) provides the execution/revenue plan and [BACKLOG.md](BACKLOG.md) tracks implementation tasks. Version numbers and model digests will be pinned during the technical spike.

Implementation progress and verified limitations are tracked in [BUILD_STATUS.md](BUILD_STATUS.md). The initial OCR implementation uses local Tesseract.js WebAssembly with tessdata_fast rather than a separately installed native Tesseract executable. The intended local processing boundary is unchanged; quality/performance gates remain open.

## 1. Product summary

**Float Dot lets you ask spoken questions about a selected desktop window and receive a useful answer in a floating panel.**

The first release helps developers and coding learners understand visible code, errors, documentation, and DSA practice problems. Voice input, screen-text extraction, and reasoning run locally. Meetings, visual diagrams, full browser-page context, and searchable memory are subsequent releases.

Tagline: **Ask your screen. Keep your flow.**

Core promise: no required paid AI API, account, or hosted service for the basic experience after local setup. Existing hardware, model downloads, power, bandwidth, and development effort remain real costs. Local performance and willingness to pay are unvalidated.

## 2. Problem and differentiation hypothesis

Users currently switch to a chat app, copy code or an error, explain the context, type a question, and return to their work. This interrupts short learning/debugging loops. Float Dot combines a selected-window snapshot with a spoken question at the point of work.

Differentiation to test:

- Context arrives from the selected window rather than repeated copy/paste.
- Push-to-talk works without mandatory keyboard input.
- Local processing provides offline utility on supported hardware.
- DSA hint progression and structured debugging responses give specific task value.
- Capture source/time remain visible so answers can be checked against their evidence.

These are product hypotheses, not claims that competing products lack the same features. The prototype must demonstrate a repeat-use advantage over a user's current chat workflow.

## 3. Users and jobs

| Persona | Job | Successful outcome |
| --- | --- | --- |
| Coding learner | Get unstuck without immediately seeing the answer | A progressive hint followed by an explanation of the learner's own attempt |
| Working developer | Understand a visible error quickly | A likely cause, evidence from the capture, and a specific next check |
| Documentation reader | Understand unfamiliar code/API terminology | A concise explanation and example grounded in visible text |
| Meeting participant, later | Recall decisions and action items | Reviewed notes linked to a captured transcript with timestamps |

Primary launch audience: individual developers and coding learners using Windows laptops. Meeting teams are a later audience with separate audio and retention requirements.

User stories:

- As a learner, I can say “one hint only” and keep control over when the solution is revealed.
- As a developer, I can ask about the selected error without manually typing its text.
- As a reader, I can ask a follow-up about the same capture and see when it was taken.
- As a user, I can stop recording or inference immediately and know what was captured.
- As a local user, I can continue using the core after disconnecting the internet.

## 4. Goals, scope, and constraints

| Release | Included | Exit evidence |
| --- | --- | --- |
| 0.1 technical spike | Local voice + screenshot OCR + local answer | Measured hardware/latency/quality report |
| 0.2 free MVP | Dot/card, selected-window capture, push-to-talk, DSA/debug/general modes, follow-ups, cancellation, local setup | Quality, offline, lifecycle, and packaged-build gates pass |
| 0.3 usability | Optional read-aloud, reviewed exports, better crop/correction, optional retained notes | Repeat users report useful outcomes |
| 0.4 experiments | Image-capable model and meeting transcription | Separate hardware/audio quality gates pass |
| Later | Browser extension, searchable memory, paid workflow packs, team customization | Evidence supports each investment |

Constraints:

- Windows 11 x64 is the first validation target. Windows 10 compatibility is exploratory until tested; macOS/Linux distribution is deferred.
- Voice input is the primary flow. A transcript correction field and typed diagnostic input remain available for accessibility and recovery.
- The selected window is explicit. Clicking the dot must not silently change the capture source to the dot itself.
- The assistant reads visible content. Hidden tabs, scrolled-off paragraphs, repository files, and call audio are not automatically available.
- Initial English UI/technical-English speech; Indian English accents included in evaluation. Additional language support requires its own tests.
- The MVP returns information and drafts. Autonomous clicking, terminal execution, email sending, and code insertion are outside this release.
- No always-on recording, wake-word engine, billing backend, cloud synchronization, or unlimited cloud inference in the MVP.
- A normal visible app identity is the default; process disguise and stealth behavior are not product requirements.

## 5. Complete proposed tech stack

| Layer | Decision | Role and release boundary |
| --- | --- | --- |
| Operating system | Windows 11 x64 | Initial reference platform; other targets need separate testing |
| Desktop runtime | Maintained Electron release | Native windows, tray, hotkeys, capture, packaged app; pin after upstream audit |
| Main process | JavaScript on Electron's bundled Node.js | Request coordination, filesystem boundaries, native workers; no separate Node install required for end users |
| UI | HTML, CSS custom properties, vanilla JavaScript | Floating dot, answer card, onboarding, settings; no framework migration required for MVP |
| Contracts | JSDoc/type checking plus explicit runtime validators | Typed service/IPC shapes; validate every incoming renderer payload |
| Build tooling | npm, lockfile, electron-builder | Native Windows-compatible scripts; portable build first, installer later |
| Microphone | `getUserMedia` + Web Audio AudioWorklet | Capture float samples locally, resample/downmix, encode 16 kHz mono PCM16 WAV |
| Speech recognition | whisper.cpp native worker/CLI | Local transcription; benchmark multilingual `base` first, `small` for accuracy and `tiny` for constrained hardware |
| Screen capture | Electron `desktopCapturer`, selected source and local crop | Capture high enough resolution for text; thumbnail enumeration alone is not accepted as readable OCR input |
| OCR | Native Tesseract + English `tessdata_fast` | Extract text/layout/confidence in a worker; bundle or document verified binaries and data |
| Reasoning runtime | User-installed Ollama, local loopback API | Readiness, model discovery, streamed chat, cancellation, unload controls |
| Default model candidate | Quantized `qwen3:4b` | Text reasoning over transcript/OCR; cannot interpret raw screenshots |
| Constrained-hardware candidate | `qwen3:1.7b`, subject to testing | Smaller option; accuracy must be evaluated independently |
| Vision candidate, later | Local image-capable Gemma 3 4B | Charts/diagrams; a separate adapter, license review, and hardware gate |
| Answer rendering | Maintained Markdown parser, DOMPurify, PrismJS | Sanitize generated HTML, highlight code, enforce restrictive CSP; pin versions after review |
| Spoken output, optional | Installed OS voice via a tested speech-synthesis adapter | Enable only a verified local voice; text always remains available |
| Settings/storage | Node filesystem, versioned JSON in app userData | Atomic writes; in-memory sessions by default; optional bounded history |
| Search storage, later | SQLite | Only after searchable history is justified |
| Logging | Local structured, redacted logs; audited existing logger if suitable | Status/timing/error codes; no raw screen/transcript/model response content |
| Tests | Node test runner and packaged-app smoke checks | Service lifecycle, input boundaries, golden fixtures; no unnecessary cloud test dependencies |
| Source control | Git and existing GitHub repository | Documentation/source/provenance; no hosted inference |
| Hosted backend | None for MVP | No required Express/FastAPI server, hosted database, vector DB, or agent framework |

Speech capture refinement: direct PCM through Web Audio replaces the earlier MediaRecorder-first proposal. It avoids making compressed-audio decoding or a separate ffmpeg installation a core dependency. The spike must verify sample-rate conversion, microphone release, and AudioWorklet compatibility with the chosen Electron build and a correctly configured secure local app origin. [AudioWorklet documentation](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) describes its separate audio-processing thread and secure-context requirement.

[Electron capture documentation](https://www.electronjs.org/docs/latest/api/desktop-capturer) defines window/screen sources and thumbnail sizing. [whisper.cpp](https://github.com/ggml-org/whisper.cpp) supports local inference and its CLI expects 16-bit WAV input. [Tesseract](https://github.com/tesseract-ocr/tesseract) and [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) provide the OCR engine/data. The [Qwen3:4b tag](https://ollama.com/library/qwen3:4b) currently lists a roughly 2.5 GB quantization; runtime memory is larger and hardware-dependent. [Ollama's chat API](https://docs.ollama.com/api/chat) supports streaming and model-dependent thinking controls. These sources establish available components, not measured Float Dot performance.

## 6. Main user journeys

### First run

Launch -> choose local mode -> see required components/download sizes -> install or locate audited dependencies -> choose downloaded model -> test microphone -> select a capture window -> ask a synthetic sample question -> see readiness status.

Downloads require internet and explicit initiation. Show progress, cancellation, retry, integrity/provenance, and remaining disk needs. Do not replace a user's existing Ollama settings silently. If cloud cannot be verified as disabled, show that offline readiness has not passed. Setup must not demand a paid key.

### Ask about the screen

Pick window -> click mic/shortcut -> show listening state -> speak -> stop -> snapshot selected window -> transcribe/OCR locally -> optional capture/transcript confirmation -> stream answer -> show source, capture time, supporting excerpt, and controls.

Snapshot occurs at recording stop; changing visible content while speaking changes what is captured. Preview makes that behavior visible. If the window is closed/unreadable, require reselection/crop rather than silently capturing the entire desktop.

### Follow-up and recapture

Ask “why?” -> reuse current capture and bounded conversation -> show “Using capture from [time]” -> answer. “Read the screen again” creates a new snapshot and visibly changes source context. Changing mode starts a new mode context; changing windows clears previous-window context unless the user explicitly chooses to carry it forward.

### DSA practice

Select DSA -> ask first hint -> answer with one conceptual nudge -> request another hint -> reveal approach -> ask to review a visible attempt -> discuss its correctness/complexity -> reveal full solution only on an explicit request. Explain insufficient context or unreadable operators.

### Debugging

Select Debug -> ask about visible error -> show observed evidence, likely cause, next verification step, and uncertainty -> follow up after recapture. Commands are displayed as suggestions, never executed automatically.

## 7. Functional requirements and acceptance criteria

M = required for MVP, U = usability follow-up, L = later. Backlog task mappings make each requirement implementable.

| ID | Priority | Requirement | Acceptance criteria | Backlog |
| --- | --- | --- | --- | --- |
| FR-01 | M | Local onboarding | Detect missing components/models; retryable setup; microphone/model tests; no mandatory key/account | FD-001/002/003/011 |
| FR-02 | M | Floating dot | Drag/collapse/expand, tray access, recover after monitor removal, configurable hotkey conflict message | FD-007 |
| FR-03 | M | Explicit source | Select a window, show its label/time, exclude app windows, handle destroyed source and DPI | FD-004/008 |
| FR-04 | M | Voice question | Click-to-start/stop, proposed `Ctrl+Shift+Space`, 30-second cap, visible recording, release mic tracks after stop | FD-003/008 |
| FR-05 | M | Local transcript | Display recognized request; allow correction or retry; silence generates no inference | FD-003/006 |
| FR-06 | M | Capture control | Preview/crop; optional per-request confirmation; no background screen polling during idle | FD-004/008 |
| FR-07 | M | Local OCR | Preserve available layout/evidence; flag low-legibility input; expose text preview; do not equate OCR confidence with correctness | FD-004/006 |
| FR-08 | M | Streamed answer | Handle chunked stream, bounded output, safe Markdown/code; show capture evidence and insufficient-context response | FD-005/010/012 |
| FR-09 | M | DSA mode | Hint progression; no full solution from “one hint”; complexity and edge cases on request | FD-010 |
| FR-10 | M | Debug/general modes | Debug response separates observed error from hypothesized cause; General explains visible text | FD-010 |
| FR-11 | M | Follow-up context | Reuse identified snapshot; cap context; recapture explicitly; avoid mixing windows or canceled requests | FD-009/010 |
| FR-12 | M | Cancellation/recovery | Stop recording/work; discard stale chunks; clear temporary media; retry without app restart | FD-008/009/012 |
| FR-13 | M | Local-only operation | Downloaded local model only, no silent fallback, core works offline and content-egress check passes | FD-005/012/014 |
| FR-14 | M | Settings | Persist source-independent preferences/model/mic/hotkeys/theme; invalid settings recover safely | FD-011/012 |
| FR-15 | M | Data controls | History off by default; clear session, optional save/export, retained-session deletion | FD-012 |
| FR-16 | M | Failure states | Friendly missing-mic/model/capture/OCR/ASR/timeout errors; no blank panel or hidden recording | FD-009/011/014 |
| FR-17 | U | Read aloud | User-enabled local voice, Stop, no feedback into recording, unavailable-voice fallback | FD-013 |
| FR-18 | U | Reviewed exports | Markdown/plain text of selected answers and evidence; explicit destination, no automatic sharing | FD-017/023 |
| FR-19 | L | Visual reasoning | Benchmark actual image input; label provider/model; no OCR-only claim of understanding chart geometry | FD-018 |
| FR-20 | L | Meeting help | Explicit audio source, visible recording, timestamped transcript, source-backed summaries and deletion | FD-019/020/021 |
| FR-21 | L | Full browser context | User-enabled extension with tab/frame identity; extraction only within granted scope | FD-022 |
| FR-22 | L | Searchable recall | Opt-in indexed local sessions, grounded search, retention controls and schema migrations | FD-023 |

## 8. UI and accessibility specification

- Proposed dot diameter: 48 logical pixels; answer card approximately 380 pixels wide, resizable with bounded height. Validate rather than treating dimensions as final artwork.
- Idle dot is calm; listening shows microphone/waveform; processing has labeled progress; errors expose a specific recovery action.
- The card contains mode, source/time, request transcript, answer, optional evidence excerpt, and Stop/Copy/Recapture controls.
- Theme follows system with manual light/dark override. CSS tokens define color, spacing, radius, and typography; reduced-motion setting disables nonessential animation.
- Keyboard navigation, visible focus, accessible control names, scalable text, and scrollable code are required. Status never depends solely on color.
- Collapsing the panel does not silently resume recording or discard an answer. Closing an active recording explicitly stops it.
- Automatic spoken output is off by default. “Read aloud” must not play in a meeting without a deliberate user action.
- For a Web Speech implementation, select an available voice reporting [`localService`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService) and verify offline behavior; if unavailable, keep text output rather than choosing a remote voice.

## 9. Technical design and data flow

```text
UI (dot / card / setup)
  -> validated preload bridge
  -> request coordinator (main)
       -> selected-window capture -> local OCR
       -> mic PCM -> local Whisper worker
       -> prompt assembly + mode + bounded context
       -> local Ollama provider -> streamed answer
  <- validated status/answer events by request ID
  -> optional installed local speech voice
```

ASR and OCR may overlap only when benchmarks show memory permits it; reasoning begins after required inputs are available. Keep heavy work outside the UI thread. Initial inference uses non-thinking mode where supported for responsiveness, with deeper reasoning an explicit later experiment. Determine capabilities from the pinned model/runtime rather than assuming support.

Proposed services: capture, audio, transcription, OCR, model provider, request coordinator, mode registry, settings/session store, diagnostic logger. Native processes run with fixed executable paths and argument arrays, no shell interpolation of transcripts or model text.

Request lifecycle: Idle -> Listening -> Capturing/Transcribing -> optional Reviewing -> Answering -> Ready. Any active stage can become Canceled or Error; both return to Idle after cleanup. Recording can pause only in the later meeting mode; a short-question retry creates a new request.

At most one question request is active. A new request cancels/replaces the existing request only after user action. Every worker event includes a request ID; old events cannot update the active panel.

### Suggested project structure (not created yet)

```text
src/
  main/        controller, windows, IPC, request coordinator
  preload/     narrow public bridge
  renderer/    dot, card, setup, settings, audio worklet
  services/    capture, audio, ASR, OCR, local model, storage
  modes/       versioned prompts and hint state
  shared/      contracts, validators, error codes
tests/
  fixtures/    synthetic screenshots, audio, expected outcomes
  services/    lifecycle and boundaries
resources/     audited native binaries and required notices
scripts/       platform-safe development and packaging helpers
```

No app source directories or binaries are implied to exist by this tree.

## 10. Data contracts, limits, and retention

| Record | Proposed fields | Lifetime |
| --- | --- | --- |
| Settings | schemaVersion, mode, modelTag/digest, localEndpoint, mic preference, shortcut, theme, confirmCapture, historyEnabled | Atomic JSON in userData |
| CaptureContext | captureId, windowId/label, capturedAt, cropBounds, OCR text/boxes/confidence, image dimensions | Active session; raw screenshot transient |
| QuestionRequest | requestId, sessionId, captureId, transcript, mode, hintLevel, createdAt | Active session |
| Answer | requestId, content, evidence excerpts, model digest, timing/status | In-memory session; optionally retained |
| DiagnosticEvent | event type, duration, status/error code, runtime/model version | Local bounded log, no content |
| Meeting segment, later | sessionId, start/end time, audioSource, text, provisional status | Explicit meeting retention policy |

Initial engineering limits, adjustable after testing:

- 30 seconds of speech per question, maximum 2,000 transcript characters; ask the user to shorten rather than silently truncate their question.
- Bound OCR input to roughly 12,000 characters; warn on truncation, offer crop, and show which context is used.
- Aim for an 8,192-token model context budget including output reserve. Token accounting must use a validated estimator/runtime support with overflow recovery; character caps alone are insufficient.
- Default short answer target of approximately 200 words, maximum generation around 512 tokens. A follow-up can request elaboration.
- Retain up to six recent turns within the token budget; visibly state when older context is dropped. Cross-window carryover is explicit.
- Audio/screenshot buffers are deleted after processing/failure/cancellation. Crash recovery clears abandoned temp files. No raw-media history is retained in MVP.
- Optional saved sessions: default expiry after seven days with a proposed 50 MB cap; user can delete immediately. User-exported files remain under user control.
- Diagnostic logs: proposed seven-day expiry and 5 MB rotation cap. Clear-all removes app-managed history/logs, and explains that model downloads/user exports are separate.

## 11. Security and local processing requirements

Use isolated/sandboxed renderers, disabled Node integration, restrictive Content Security Policy, validated IPC sender/payloads, sanitized answer HTML, blocked arbitrary navigation, and explicit microphone permission handling. These follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

Treat OCR/transcripts as untrusted content. Screen text cannot alter the application's mode, run code, or invoke external actions. Prompts label screen excerpts as data; the renderer cannot grant filesystem/process access through a model answer.

Ollama endpoint defaults to `http://127.0.0.1:11434`. Permit loopback only in local mode; validate resolved endpoint/redirect behavior and model selection. Do not expose an unauthenticated worker/server on external interfaces.

[Ollama's FAQ](https://docs.ollama.com/faq) documents `OLLAMA_NO_CLOUD=1` and a cloud-disable configuration, which require runtime restart. Setup guides the user through supported configuration and verifies it for the pinned version. A localhost API URL alone is not proof of local inference. A full offline run plus content-egress observation is a release gate. Model downloads and user-approved update checks are separately identified network operations.

Local storage is subject to the user's OS account/file permissions; app-specific at-rest encryption is not promised in MVP. Sensitive meeting/team use requires a retention/security review before that release. Optional API-key support, if introduced later, requires OS-backed secret storage and explicit cloud data handling.

## 12. Nonfunctional requirements

All numerical criteria are targets, not achieved results. Benchmark on a recorded Windows 11 x64 reference machine, initially aiming at 16 GB RAM and about 10 GB free disk. A CPU-only run is required to establish whether the default model is practical; GPU performance is reported separately.

| ID | Requirement | Acceptance target |
| --- | --- | --- |
| NFR-01 | UI responsiveness | Recording/Stop state acknowledgment within 250 ms on reference machine; no heavy worker blocks UI |
| NFR-02 | Answer latency | Warm median <=15 seconds from recording stop to first final-answer text across 30 examples; report p95 and cold-start separately |
| NFR-03 | Cancellation | UI immediately acknowledges Stop; microphone tracks released within 1 second; worker/model stop or confirmed disconnect within 2 seconds; stale output discarded |
| NFR-04 | Grounded usefulness | At least 24/30 primary examples pass the rubric below |
| NFR-05 | Hint control | All ten first-hint DSA cases withhold the full solution; reveal only on explicit request |
| NFR-06 | Lifecycle reliability | Ten consecutive short requests without crash, leaked microphone, context crossover, or orphaned app-owned worker |
| NFR-07 | Offline core | Works after setup with internet disconnected and no content-egress requests during observation |
| NFR-08 | Resource reporting | Publish idle/peak app + worker + inference memory and CPU usage; no universal memory ceiling claimed before spike |
| NFR-09 | Accessibility | Core journey completes using keyboard; focus/state understandable with screen reader and reduced motion |
| NFR-10 | Distribution | Portable build runs outside checkout with documented local dependencies and no development-only paths |
| NFR-11 | Failure recovery | Missing model/mic/window, malformed stream, timeout, and worker crash yield actionable recovery without app restart |

If warm latency exceeds the target, test smaller models, fewer tokens, and worker/model prewarming. Prewarming must expose resource use and be optional. If accuracy then fails, narrow supported claims/use cases rather than silently changing to paid cloud inference.

## 13. Meeting release requirements

Meeting work begins after the MVP gate passes. Start with explicit microphone transcription, then independently validate Windows loopback/call audio. Microphone-only mode must say it may not capture remote participants wearing headphones.

- Start/Pause/Stop controls, selected audio source, visible recording indicator, and clear participant-consent responsibility.
- Timestamped rolling transcript; proposed ten-second audio segments with overlap/deduplication, adjustable after the spike.
- Bounded summary window such as the last ten minutes, with coverage gaps and timestamps stated.
- “Decisions” and “proposals” are distinguished. No invented owner/deadline; unknown fields remain unknown.
- Action items and summaries cite transcript timestamps and are reviewed before export.
- Speaker names are absent unless verified through a separately evaluated attribution system.
- Evaluate a synthetic 30-minute meeting, pauses, overlapping speech, headphones, device switching, interruption, and crash cleanup.
- Proposed meeting gate: at least 90% of annotated decisions recovered with no unsupported decisions presented as settled facts. Report omissions and ambiguous speech separately.

Meeting settings/retention policy must be presented before recording. Its release schedule depends on audio reliability; estimate an additional 40-80 focused hours after the MVP, with no fixed completion promise.

## 14. Evaluation and analytics

Primary corpus: 30 synthetic cases, ten each for DSA, error/code, and documentation. Each includes ground-truth screen text, a short spoken request, required facts, acceptable answers, and disallowed hallucinations. Include quiet/moderate noise, technical vocabulary, and Indian English speakers where available.

Pass rubric: the answer addresses the spoken request, is supported by available text or explicitly labeled general reasoning, avoids a material false claim, states missing evidence, and respects mode/hint level. Count a case as failed if any required condition fails. Review disputed judgments manually; do not use an LLM grader as the sole authority.

Component checks separate transcription errors, OCR errors, prompt/model errors, and lifecycle errors. Benchmark original visible inputs plus corrected text to identify whether extraction or reasoning is the bottleneck.

Product measurement stays local/opt-in during the pilot. Record content-free counts/timings if the user enables diagnostics; users can export a redacted report deliberately. No mandatory remote analytics.

Pilot hypotheses with ten invited testers:

- At least five finish setup and one real question.
- At least three use Float Dot on three distinct days within a week.
- At least three report a specific useful result, supported by an example/time comparison.
- Obtain two real paid pilot purchases before building a payment/team backend.

These thresholds guide decisions from a small sample; they do not establish market size. With poor retention, improve the core job before adding new modes.

## 15. Monetization and costs

Keep the basic local voice + screen assistant free. Paid offers sell tailored workflows, convenience, deployment, and bounded support. No required paid inference is introduced into the free path.

| Offer | Deliverable | Price hypothesis |
| --- | --- | --- |
| Developer pack | Tested debug playbooks, project context presets, reviewed bug-report export | Rs 499 one-time for the stated version |
| Meeting pack, later | Transcript-backed decisions/action items and reviewed exports | Rs 999 one-time for the stated version |
| Remote setup | Hardware check, install help, one tailored workflow, bounded session | Rs 1,499 per session |
| Small-team pilot | Up to five users, tailored playbooks, deployment guide, defined training/support | Rs 5,000 per pilot |

Prices require actual customer testing. Free functionality must not become artificially unusable to force an upgrade. Paid code/data licensing, update entitlements, and support period must be explicit. Open-source runtime/model licensing does not itself establish a viable business model.

Early delivery can be manual with no account server. Track sales, fees, refunds, support time, and customer outcomes. No lifetime support promise or subscription before recurring value is established. Public distribution, signing, payment processing, and taxes may cost money; the zero-required-cash objective applies to the local prototype on adequate existing hardware.

## 16. Execution plan and dependencies

Revised one-developer estimate: 94-140 focused hours, approximately 4-6 weeks at 25 hours/week or 7-10 weeks at 15 hours/week, followed by about one week of repeat-use/pilot feedback. This replaces the earlier five-week estimate at 10-15 hours/week after inspecting the actual reference code. See [REFERENCE_AND_TIMELINE.md](REFERENCE_AND_TIMELINE.md) for stage estimates and the pinned source reuse map. Re-estimate after the spike. The priority is exit evidence, not a calendar promise.

| Milestone | Deliverables | Gate |
| --- | --- | --- |
| 1: feasibility | Upstream audit, local ASR/OCR/model tests, hardware report | One useful local end-to-end question |
| 2: desktop loop | Dot/card, source chooser, audio, cancellation, worker coordination | Reliable ten-request sequence |
| 3: coding value | Modes, hints, bounded context, evidence, safe renderer | Primary quality rubric passes |
| 4: tester release | Onboarding, package, notices, lifecycle/offline validation | Five testers can install/use from guide |
| 5: paid validation | Demo, feedback, tailored workflow/setup offer | Repeat-use and actual-payment evidence recorded |

Critical path: dependency/provenance review -> local benchmarks -> integrated pipeline -> lifecycle/UI -> evaluation/package -> repeat-use testing. Optional speech output and paid infrastructure cannot block core release.

OpenCluely reference is pinned at `0a9da75135f5aade3a067d86a7c8bb73f372f014` in an ignored local checkout. Source triage and the reuse map are complete; application import and full runtime/dependency/asset audit are not. Before importing modules, complete license/NOTICE/assets/dependencies/script review. See [PLAN.md](PLAN.md) for the observed Apache/MIT/ISC label discrepancy. Preserve required upstream notices and mark modifications. Audit capture, speech, LLM, window, and session seams rather than executing upstream setup blindly.

## 17. Risks and decision gates

| Risk | Mitigation/check | Decision if unresolved |
| --- | --- | --- |
| Hardware too slow | CPU/GPU benchmarks; bounded context/model size | Narrow supported hardware or workload |
| OCR changes important code | Crop/preview, critical-token fixtures, correction | Require clearer input; optional vision spike |
| Spoken technical terms misread | Transcript preview, accent/noise evaluation | Tune model or require correction for that input |
| Local model fabricates | Grounded rubric, insufficient-context behavior | Restrict supported claims; improve before launch |
| Wrong tab/stale screenshot | Persistent selected-window identity and capture time | Require explicit recapture/reselection |
| Upstream reuse costs too much | Audit and compare minimal shell | Reuse fewer modules and record provenance |
| Loopback audio unreliable | Separate headphones/device/long-session spike | Ship accurately labeled microphone-only feature |
| Low repeat use or payment | One-week pilot and real offer | Improve core job or narrow buyer before expanding |
| Support erases revenue | Track session/support cost per buyer | Narrow supported setup or adjust scope/pricing |

## 18. MVP definition of done

- All M requirements implemented and linked to verification evidence.
- NFR gates pass or a documented reduced scope explicitly replaces the unmet claim.
- No paid key/account required; offline behavior verified after downloads.
- Source/time, listening indicator, cancellation, temporary-media cleanup, and failure recovery verified.
- Thirty-case report, reference hardware, model digests, cold/warm timing, limitations, and dependency notices published with the tester build.
- Packaged build works outside the development checkout; README covers setup, controls, troubleshooting, supported hardware, and deletion.
- No feature is labeled implemented solely because it appears in this PRD.

## 19. Open questions to resolve during the spike

1. What CPU/RAM/GPU and free disk are available on the founder's machine and first testers' machines?
2. Does the default Qwen model meet both quality and warm-latency targets without a dedicated GPU?
3. Does Whisper base handle technical vocabulary well enough, or is small worth the latency?
4. Which Electron capture path preserves readable text and correct crops across mixed-DPI monitors?
5. Which native binary distribution/build process is reproducible and license-compliant for the selected versions?
6. Do users return primarily for DSA, debugging, or documentation help, and which tailored workflow earns payment?

The first implementation task is FD-001, followed by the bounded hardware/ASR/OCR/model spike. Build decisions are revised from measured evidence, while preserving the free local core.
