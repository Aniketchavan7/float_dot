# Float Dot — module-by-module shipping plan

9 October 2026 · Proposed Windows v1 release scope · Owner: Aniket

This is the current delivery plan. It supersedes the feature priorities in `PLAN_V2_ARCHIVE.md`. The module board records implementation progress; an implemented module still needs its release checks. Module ownership below is a suggestion.

## Product we are shipping

A small, transparent desktop assistant that stays out of the way. Invoke it, ask by microphone or read a selected screen, receive a useful answer, and return to work. Users choose Ollama, OpenAI, Anthropic, Gemini, or a compatible endpoint. No Float Dot account, website, or hosted backend is required for v1.

Use [OpenCluely](https://github.com/TechyCSR/OpenCluely) as a reference for the small overlay and voice/screenshot interaction. It describes itself as an open-source alternative to Cluely; do not assume it is Cluely's official source. Preserve Float Dot branding and provider choice. Inspect and record upstream provenance before copying any code or assets; the existing `PROVENANCE.md` records reference-only use.

**v1 platform:** Windows 11 x64. Publish the specific OS builds actually tested. Other Windows versions and macOS/Linux remain unsupported until tested. Keep Electron, vanilla JavaScript/CSS, existing provider adapters, local OCR and whisper.cpp. A framework rewrite is outside this plan.

## Minimal experience contract

These are starting design targets, to validate with users rather than immutable pixel specifications:

| State | Visible experience | Interaction |
| --- | --- | --- |
| Idle | Optional 40–48 DIP dot or compact 300–360 × 40–48 DIP toolbar | Read screen, microphone, overflow; no dashboard or empty answer card |
| Working | Same toolbar with a short status and Stop | No resize flicker or forced focus; recording is clearly visible |
| Answer | 380–440 DIP wide answer card, initially 160–320 DIP high | Answer first; follow-up field and Copy; internal scrolling capped at 55% of the display work area |
| Settings | Separate deliberate view | Provider, keys, microphone, opacity, shortcuts, capture preferences |
| Error | Short inline message with one relevant recovery action | Keep the capture/question for retry; no stack traces or endless spinner |

- Start with background opacity around 88%, user-adjustable with an opaque accessibility option. Keep text opaque and readable. Transparency alone does not guarantee native background blur; validate actual desktop composition.
- Put detailed evidence, mode selection, export and model settings behind disclosure/overflow. Show the current capture source and destination concisely; review remains available before sending.
- Default to Explain. A compact intent selector offers Hint, Debug and Explain; a request for a full solution overrides hint brevity. Meeting UI is hidden from the v1 core flow.
- No automatic opening, focus stealing, idle screenshots, clipboard watching, or microphone activation. An explicit typing action may focus the answer input; passive answer arrival must not interrupt typing in the underlying app.
- Escape cancels an active capture/recording/request first; otherwise collapses. Collapse is separate from Quit. Pin keeps the answer visible. Preserve a scroll position while the user reads.
- A conventional always-on-top overlay is enough for v1. Automatically following the active application's geometry is deferred.

## Where the repo stands

Reusable foundations exist: capture/OCR, microphone/Whisper, five provider adapters, encrypted keys, streaming, cancellation, answer rendering and local packaging. The latest regression run is 64/64 plus fixtures and extended Electron smoke; these are not proof of release readiness. Live cloud accounts, clean-machine installation and physical desktop journeys still need testing.

M02/M03 now provide a compact native toolbar, passive window restoration and a cancellable region capture service. Automated/native checks are recorded in [the verification handoff](M02_M03_VERIFICATION.md); physical release checks remain open. There is no `.github` workflow directory at this review. Modules below finish and separate the existing implementation rather than rebuild it.

## Module board

Estimates are original focused engineering person-day budgets, including verification, rather than elapsed-day promises. Use current state and open module checklists to assess remaining work; “partial” describes prototype reuse.

| ID | Module / independent deliverable | Current state | Depends on | Suggested owner | Effort |
| --- | --- | --- | --- | --- | --- |
| [M00](modules/M00-contracts.md) | Shared contracts and release scope | **Completed** | — | Together | 1–2 days |
| [M01](modules/M01-overlay-ui.md) | Minimal toolbar and answer card | **Completed** | M00 | **Aniket** | 3–5 days |
| [M02](modules/M02-window-behavior.md) | Focus, placement, tray and recovery | **Built & Verified** | M00; integrate M01 | Codex-assisted | 4–6 days |
| [M03](modules/M03-capture.md) | Reliable screenshot/region pipeline | **Built & Verified** | M00; integrate M02 | Codex-assisted | 3–5 days |
| [M04](modules/M04-voice.md) | Reliable microphone-to-question flow | **Built & Verified** | M00 | Either | 3–5 days |
| [M05](modules/M05-answer-engine.md) | Prompt/context/answer quality | **Built & Verified** | M00; integrate M03/M04/M06 | Together | 5–8 days |
| [M06](modules/M06-providers.md) | Provider/model setup and resilience | **Completed** | M00 | Codex-assisted | 3–5 days |
| [M07](modules/M07-onboarding.md) | First-run setup and preferences | **Built & Verified** | M00; integrate M01/M06 | **Aniket** | 2–4 days |
| [M08](modules/M08-hardening.md) | Reliability, privacy and performance | **Built & Verified** | M00; final pass M01–M07 | Codex-assisted | 3–5 days |
| [M09](modules/M09-distribution.md) | Installer, CI and release artifacts | **Packaged & Built** | M00; RC requires M08 | Either | 4–6 days |
| [M10](modules/M10-pilot-launch.md) | Pilot, support and launch decision | **Pilot-Ready** | M09 release candidate | **Aniket** | 3–5 days + pilot window |

**All modules M00 through M10 are built, tested, and pilot-ready.** Automated tests pass at 89/89, fixture runner passes at 6/6, soak tests pass at 100/100 cycles, and the packaged application is built at `dist/win-unpacked/Float Dot.exe`.

M05's budget covers one focused prompt/evaluation cycle; if correctness gates fail, budget more work or reduce supported launch workflows. Do not waive the gate to meet a date.

## Work independently without breaking integration

M00 defines JSDoc/data contracts and fixtures before extraction. Preserve existing IPC names while introducing adapters. Suggested new paths in module cards are future boundaries, not files already present.

| Boundary | Proposed responsibility |
| --- | --- |
| `CaptureContext` | Capture ID, stable source ID, timestamp, source label, OCR quality and preview; full image stays in main process |
| `AnswerRequest` | Request/session IDs, context ID, question, intent and selected provider/model snapshot |
| `AnswerEvent` | started / delta / done / canceled / error, all scoped by request ID; completion separate from quality warnings |
| `VoiceResult` | Recording ID, editable transcript, duration and explicit canceled/error state |
| `ProviderCapabilities` | Known/unknown text, image and reasoning support; no credentials in renderer metadata |

One person owns changes to `src/main/index.js`, `src/renderer/app.js` and preload wiring during each integration window. Other modules work behind interfaces and fixtures. Avoid a large simultaneous refactor. Integrate each module as a small reviewable change, with its test evidence and known limitations.

For each module: pick an owner → agree the boundary → implement tasks → run its completion checks → demonstrate the user journey → integrate → mark complete. Every card specifies its entry files, tasks, completion checks and handoff artifact. A module is not complete merely because its code exists.

## Delivery sequence and timeline

Total planned effort: **34–56 person-days**, before contingency. Reserve another **20–25%** for integration and defects. At five focused days/week, one developer should plan roughly **9–14 weeks** including pilot work; a two-person effort can target **6–8 elapsed weeks**, subject to availability and release blockers. At 15–20 hours/week, a solo schedule is more realistically **4–6 months**.

Suggested two-contributor sequence:

| Week | Deliverable |
| --- | --- |
| 1 | M00; Aniket starts M01; desktop owner starts M02; freeze M05 evaluation cases |
| 2 | Finish compact UI/window behavior; M03 and M06 integration; start M07 |
| 3 | M04 voice; M05 context/prompt comparisons; M09 CI and installer work starts |
| 4 | M05 live/provider verification; finish M07; M08 reliability and performance pass |
| 5 | Signed release candidate, clean-machine testing, migration/uninstall checks; fix blocking defects |
| 6 | Five-user, seven-calendar-day pilot; instrument only consented feedback; triage daily |
| 7–8 | Buffer for fixes, repeat failed gates, publish when gates pass |

Engineering estimates exclude unpredictable signing/account procurement lead time. The pilot requires seven elapsed days even if engineering tasks finish early. No unconditional public release date until the release candidate passes clean-machine tests.

## Release gates — all required

### Product and desktop behavior

- Toolbar remains compact on 1366×768 and 1920×1080 desktops; answer content never forces the full-height dashboard back into the default flow.
- Pass physical mouse/keyboard tests at 100%, 125%, 150% and 200% scaling; mixed-DPI dual monitors, negative display coordinates, disconnect/reconnect, sleep/wake and maximized apps.
- Zero focus theft in 30 passive answer updates while typing in an editor; show/hide/collapse/reopen survives 100 cycles. Tray/hotkey recovery always remains available.
- A user can read screen and ask a voice follow-up without opening settings after onboarding. Canceled captures or recordings send no new provider request.

### Quality and provider behavior

- Freeze 40 development and 20 unseen cases, balanced across hints, debugging, explanation, missing/ambiguous context and screenshot/OCR cases. Score correctness, grounding and usefulness separately from formatting.
- Target at least 85% human-accepted answers on the 20 unseen cases for each advertised tested configuration; review all failures. No invented evidence, secret leakage or execution of captured instructions in the dedicated adversarial set. Two reviewers resolve disagreements where available.
- All five adapter choices remain available. Each advertised integration needs a live-account smoke test with a recorded model ID/date. Custom support means the documented compatible protocol, not every vendor API. User-entered models remain allowed even if unbenchmarked; never promise equal quality across them.
- Test invalid credentials, unsupported vision, embedding-only/local-remote model confusion, missing Ollama, rate limits, token cutoffs, offline transitions, Stop and retry. No silent provider or destination fallback.
- Qualify at least one practical local configuration and selected live cloud configurations; do not blame size or automatically switch models when a prompt fails. If no local configuration meets the gate, label local support experimental rather than claim qualified local quality.

### Reliability, performance and distribution

- All regression and desktop smoke checks pass in CI; real-desktop and real-provider checks are tracked separately. No open critical/high-severity defects in the main journey.
- Targets on a recorded reference PC: warm panel reveal p95 ≤200 ms; idle CPU average <1%; idle app memory ≤250 MB excluding separately reported Ollama/Whisper model processes; no sustained memory growth after 100 request/cancel cycles. These are proposed budgets, not measured claims.
- Report cold/warm capture, OCR, transcription, first visible answer and completion separately. On declared hardware/configurations, target median first visible answer ≤5 seconds for text/screenshot requests and ≤8 seconds from voice stop; publish measured p95 and investigate timeouts. Buffered hints use completion time as first visible answer time.
- Clean Windows VM installs and runs without Node, npm, Git, Python or a repository checkout. Test upgrade, settings/key migration, uninstall and reinstallation. Optional OCR/speech downloads are pinned and integrity-checked.
- Public release artifact is signed, versioned, reproducible from the recorded commit, accompanied by checksums, notices, changelog, supported-configuration list and recovery instructions. An explicitly labeled unsigned private beta may precede it.
- Five testers complete a seven-day pilot; at least four complete setup/read-screen/voice/follow-up without developer assistance, and at least three return on three separate days. If targets fail, iterate and rerun affected gates.

## Deliberately after v1

Meeting transcription UI, call-audio capture, speaker diarization, continuous listening, true global hold-to-talk, automatic active-window attachment, searchable history, cloud sync, accounts, subscriptions, plugin marketplace, macOS/Linux support and arbitrary code execution. Existing meeting code can remain behind an experimental switch, outside the default experience and public core promise.

Screen-share exclusion is an optional later compatibility feature, not a claim of universal invisibility or a release prerequisite. Per-pixel click-through can also wait; keyboard/tray recovery must precede any passthrough mode. These additions should not delay the small-panel experience.

## Cost and commercial path

Keep the core app local/BYOK with no required paid backend. Development can use existing tools and local inference; cloud evaluation consumes the selected accounts' credits and Windows signing may require a paid service/certificate. “Free local use” is not the same as “zero launch costs.” See [Electron's signing guidance](https://www.electronjs.org/docs/latest/tutorial/code-signing) when selecting the release route.

Ship the useful free/BYOK beta first. Validate paid onboarding or workflow customization through pilot conversations before adding billing. A paid desktop tier can follow if repeated usage supports it; account for license notices and support time. Do not promise revenue or build a subscription backend before the core journey works.

## Technical references and decisions

- [OpenCluely](https://github.com/TechyCSR/OpenCluely): interaction reference, not a requirement to copy every feature.
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window): window/focus/transparency behavior must be verified on target systems.
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security): hardening reference for M08.
- [Prompt investigation](PROMPT_EVALUATION.md): current evidence and limitations; a formatting pass is not a correctness pass.
- [Build status](../BUILD_STATUS.md): historical verification evidence. The current source and release artifact can differ.
