# Float Dot: product and execution plan

Planning date: 8 October 2026. Scope: a plan for a local desktop product, not a finished application.

The [PRD.md](PRD.md) specifies detailed product requirements and release gates. It refines microphone capture to direct PCM through Web Audio and sets Windows 11 x64 as the first validation platform; Windows 10 remains exploratory until tested.

## 1. Product and first customer

**Float Dot is a small, visible desktop companion that answers spoken questions about a selected window.** The first audience is developers and coding learners who keep switching between their editor, browser, and chat assistant.

Initial job: understand a visible problem or error without copying it into another app. The first promise is **“Ask about what you are looking at.”** The longer-term product can remember user-selected session context and create useful notes.

Start with DSA practice and debugging. These have short inputs, repeatable demonstrations, and clearer evaluation than a general assistant for everything. Meeting support is part of the roadmap, with its own audio and accuracy milestones.

## 2. Concrete experience

1. First run checks microphone access, local model availability, and OCR/transcription dependencies.
2. The user picks a window through a thumbnail chooser. Capture source is shown next to the dot.
3. Click the dot or press the configurable shortcut to start recording. Press again to stop; enforce a 30-second limit for the first version.
4. Capture the chosen window at recording stop, without the Float Dot UI. Show a preview and capture timestamp.
5. Transcribe speech and extract visible text locally. Preview is available; a setting can require confirmation on every capture.
6. Answer in a compact card, initially limited to about 200 words. Offer “Explain more,” “Next hint,” “Copy,” and “Stop.”
7. A follow-up reuses that snapshot until the user asks for a new capture. Keep the source and timestamp visible so old context is obvious.
8. Optional “Read aloud” uses an installed OS voice where available; users can interrupt playback.

Dot states: idle, listening, reading screen, answering, and needs attention. Combine animation with text and icons so state is understandable without color. The panel can be dragged and collapsed. Remember its position while keeping it within current monitor bounds.

The MVP reads pixels in one selected window. It does not know invisible content, other tabs, or an entire scrolling page. A browser extension can later supply permitted page text. In a browser, different tabs share the same window: recheck the capture preview when switching tabs.

## 3. Use cases worth demonstrating

| Use case | Spoken request | Useful result | Phase |
| --- | --- | --- | --- |
| DSA hint ladder | “One hint, no solution.” | Hint, then approach, then solution only when requested | MVP |
| Debug buddy | “What is causing this error?” | Explain the visible stack trace and propose the next check | MVP |
| Code walkthrough | “Explain this function with an example.” | Plain-language explanation grounded in the visible code | MVP |
| Edge-case finder | “What cases could break this?” | Candidate tests and assumptions for the selected solution | MVP |
| Documentation translator | “Explain this API example simply.” | A short explanation using the visible documentation | MVP |
| Meeting slide helper | “Explain the diagram on this slide.” | Explain visible labels; request clearer input when needed | Vision experiment |
| Meeting catch-up | “What did we decide in the last ten minutes?” | Summary with transcript timestamps, decisions, and uncertainties | Meeting phase |
| Action-item extraction | “Turn this meeting into tasks.” | Draft tasks linked to transcript evidence for review | Meeting phase |
| Document navigator | “What does this paragraph mean?” | Explain selected visible text with supporting excerpts | After MVP |
| Session recall | “What fixes have we already tried?” | A local summary of retained user-approved session notes | After MVP |

Three short demo scripts: a two-sum hint, a missing-module error explanation, and an API documentation walkthrough. Use synthetic inputs so demonstrations do not expose personal data.

Practice mode should teach progressively. Meeting transcription starts through a visible recording control with participants informed and consent handled. The MVP provides answers and drafts; it does not execute commands or send messages.

## 4. Stack with no required paid API

| Layer | Initial choice | Reason and limitation |
| --- | --- | --- |
| Desktop | Electron + JavaScript, retaining audited upstream components | Faster reuse; measure memory footprint and update dependencies before release |
| Capture | Electron capture service with explicit window selection and crop | One snapshot per request; ensure overlay exclusion and correct monitor scaling |
| Microphone | Renderer getUserMedia + Web Audio AudioWorklet, local PCM16 WAV encoding | Verify resampling/mono conversion; avoid remote browser speech services and required compressed-audio tooling |
| Speech recognition | whisper.cpp with a small downloaded Whisper model | Local CPU operation and Windows support; accent/noise quality must be measured |
| Text extraction | Tesseract OCR, local worker | Practical text-first baseline; indentation and punctuation may be misread |
| Reasoning | Ollama local API + quantized `qwen3:4b` candidate | Text model consumes OCR/transcript, not screenshots |
| Low-memory experiment | Smaller Qwen3 variant | Benchmark separately; do not claim equivalent quality |
| Visual understanding | Optional local Gemma 3 4B candidate | Image-capable alternative for charts; extra hardware and separate model terms |
| Spoken output | Installed OS speech synthesis voice | Availability and languages vary; text response always remains usable |
| Persistence | Versioned local JSON settings; session history opt-in | No database/server needed initially; SQLite only when search justifies it |
| Distribution | Portable Windows build for testers | No purchased hosting needed initially; public trust/signing is a later expense |

[whisper.cpp](https://github.com/ggml-org/whisper.cpp) documents local inference, including CPU and Windows support. [Ollama](https://docs.ollama.com/api/introduction) exposes a local API without an API key. [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B) is a text model under Apache 2.0; the current [Ollama quantization](https://ollama.com/library/qwen3:4b) is about 2.5 GB on disk. That file size is not a RAM requirement. [Tesseract](https://github.com/tesseract-ocr/tesseract) supplies OCR. [Gemma 3's model card](https://ai.google.dev/gemma/docs/core/model_card_3) documents its image-capable variants; review their terms before distribution.

Local-only mode must select downloaded local models, disable cloud features where supported, and verify outbound traffic. Ollama can also access cloud models, so localhost alone is not sufficient evidence of offline processing. See its [FAQ](https://docs.ollama.com/faq).

Do not make a cloud free tier a required dependency. Provider quotas, model availability, and terms can change. A user-funded cloud adapter may be added later as an explicit choice, with no automatic fallback or bundled promise of free usage.

## 5. Hardware and performance gate

The machine's RAM/GPU could not be read in this session because system inventory access was unavailable. The following are benchmark targets, not verified minimum requirements:

- Start testing on Windows 11 x64, 16 GB RAM, an existing microphone, and roughly 10 GB free disk for dependencies/models; assess Windows 10 separately before claiming support.
- Compare an 8 GB RAM CPU-only machine with a smaller text model before advertising low-end support.
- GPU acceleration is optional for the text-first experiment; measure responsiveness before promising it.
- Run speech and reasoning sequentially when memory is constrained. Bound retained context and allow models to unload.
- Warm-request target: first answer text within 15 seconds after recording stops for a typical short prompt on the recorded reference machine. Report cold-start latency separately. These are acceptance targets, not measured results.

If local latency is poor, first reduce context/model size and simplify output. If quality drops too far, narrow supported use cases. Do not advertise real-time vision or unlimited high-quality AI until demonstrated.

## 6. Architecture and boundaries

```text
Floating dot / response card
        |
        | narrow, validated IPC requests
        v
Main-process request coordinator
   |                 |
   v                 v
Mic recording     Selected-window snapshot
   |                 |
   v                 v
Local ASR         Local OCR (optional vision path later)
   |                 |
   +--------+--------+
            v
Question + source text + mode + bounded session context
            |
            v
Local model adapter -> streamed answer -> response card / optional voice
```

Services proposed for implementation:

- `capture.service`: source selection, snapshots, crops, timestamps, destroyed-window handling.
- `speech.service`: recording lifecycle, PCM conversion, ASR process, transcription errors.
- `ocr.service`: worker queue, text and confidence, code-layout checks.
- `model.provider`: `health()`, `listModels()`, `streamAnswer(request, signal)`.
- `request.coordinator`: one request ID, cancellation, stale-event rejection, bounded timeouts.
- `session.store`: settings plus optional history; clear, export, retention limits.
- `mode.registry`: versioned prompt definitions for DSA, debug, and general mode.

Treat screen text as data, including text that tries to instruct the assistant. Separate it from the user's spoken request and system rules. Cite a short supporting screen excerpt for factual explanations where possible. Say when the capture does not contain enough information.

Keep Node out of renderer pages, expose a narrow preload API, validate IPC payloads, sanitize rendered model Markdown, and block unsolicited navigation. Never log raw screenshots, transcripts, or API keys. Offline mode has no remote telemetry. Session retention is off by default; temporary capture/audio files are removed after processing, cancellation, failure, and next startup recovery.

## 7. Reuse OpenCluely carefully

The upstream main.js wires capture, speech, LLM, window, and session services. A pinned local checkout has now been inspected; see [REFERENCE_AND_TIMELINE.md](REFERENCE_AND_TIMELINE.md) for the exact commit and concrete reuse map. This is source triage rather than a completed runtime/dependency audit.

| Upstream area | Planned treatment |
| --- | --- |
| Window and shortcut orchestration | Reuse behavior after source/dependency review; replace main overlay with the dot and card |
| Capture service | Adapt for explicit selected-window snapshots and crop previews |
| Speech service | Evaluate current local worker; choose one maintained local backend for MVP |
| LLM service | Replace mandatory Gemini routing with the local provider interface |
| Prompt loading and session manager | Reuse only if isolation, bounds, and retention semantics match the design |
| Stealth/process disguise | Remove from the Float Dot default experience; retain an ordinary visible app identity |
| Onboarding | Replace API-key requirement with local dependency/model readiness |
| Build scripts | Make development scripts work in native Windows PowerShell; review packaged assets and licenses |

Before reuse, pin a commit and save its provenance. The repository currently has conflicting labels: [LICENSE](https://github.com/TechyCSR/OpenCluely/blob/main/LICENSE) contains Apache 2.0, README says MIT, and [package.json](https://github.com/TechyCSR/OpenCluely/blob/main/package.json) says ISC. Review the pinned files and any distinct asset/dependency licenses. Preserve required notices, ship the applicable license, mark modified files, and include NOTICE attribution if present. Do not claim ownership of upstream code or reuse its branding as ours.

An unmodified upstream checkout is available locally at `.reference/OpenCluely/`, excluded from Git. No upstream source has been imported into Float Dot application code and no upstream setup/executable has been run.

## 8. Execution sequence and revised timeline

Current estimate: 94-140 focused engineering hours for one developer, about 4-6 weeks at 25 hours/week or 7-10 weeks at 15 hours/week. Add about one week for repeat-use/pilot feedback. This replaces the earlier optimistic five-week estimate at 10-15 hours/week. Detailed assumptions and add-on estimates are in [REFERENCE_AND_TIMELINE.md](REFERENCE_AND_TIMELINE.md). Re-estimate after the hardware spike. Advance by passing the milestone gate, not just reaching a date.

| Milestone | Work | Exit gate |
| --- | --- | --- |
| Stage 1: prove local loop | Complete upstream audit; benchmark transcription, OCR, and local model on synthetic samples | One screenshot + voice question -> useful offline answer; measurements recorded |
| Stage 2: usable desktop | Local pipeline, dot, capture chooser, push-to-talk, preview, states, cancellation | Complete 10 consecutive requests without crashes, source confusion, or lingering recording |
| Stage 3: useful coding assistant | DSA hint ladder, debugging mode, context limits, Markdown, optional voice | Quality gate below passes on representative samples |
| Stage 4: ship tester build | Local onboarding, portable package, cleanup, error handling, settings | Five testers can set up from written instructions; core works with network disconnected |
| Stage 5: validate paid value | Demo, user interviews, workflow-pack prototype, paid setup pilot | Document willingness to pay, actual purchases, support time, and retention |

Continuous meeting transcription begins only after the desktop loop and retention policy pass. Implement microphone input first, then evaluate a maintained Windows loopback method to capture call audio. Label microphone-only coverage honestly; it may miss remote speakers. Check headphones, separate audio devices, long sessions, and speaking-over-each-other cases. Do not promise speaker attribution until evaluated.

## 9. Test and release gates

Use 30 synthetic examples: 10 DSA problems, 10 error/code captures, and 10 documentation captures, with ground-truth text and expected facts. Ask spoken questions in quiet and moderate-noise conditions; include Indian English pronunciations and common technical terms.

- For the primary demo corpus, at least 24/30 answers must be useful and grounded according to a written rubric. Review disagreements manually.
- DSA tests must preserve hint level; a first hint cannot reveal the full solution.
- OCR must preserve critical names/operators on chosen code samples or flag uncertainty and offer a crop or user correction. Do not silently invent unreadable code.
- Test stale screenshots, closed windows, browser-tab switches, multi-monitor DPI, absent microphone, missing model, model timeout, and ASR crash.
- Cancellation must stop microphone/child work and prevent stale output appearing in a later request.
- Verify no capture occurs during idle and no outbound content requests occur in offline mode after setup. Use network inspection in addition to an offline run.
- Verify cleanup after cancellation and crash recovery; exported history is the user's explicit choice.
- Record RAM use, cold/warm latency, model versions, and hardware. Do not label numerical targets as achieved until measured.
- Installer/package smoke test must run outside the developer checkout with no development paths.

## 10. Actual cost model

| Item | Core prototype plan | Qualification |
| --- | --- | --- |
| AI calls | No billed API calls | Runs on user's existing computer; computation consumes power |
| ASR/OCR/runtime | No required license purchase for selected open-source tools | Preserve licenses and inspect model/asset terms separately |
| Hosting/database | None | Desktop app and local storage |
| Website/domain | Optional, defer | A repository README and demo are enough for validation |
| Testing | Personal machine + volunteer testers | Time and bandwidth are costs; no new GPU budget assumed |
| Distribution | Direct tester builds; public repository/release option when appropriate | Check current platform limits before relying on free distribution |
| Signing, payment processing, support | Defer paid tooling until justified | Public release may need signing; sales incur fees/taxes and support time |

The core can be zero required cash outlay if existing hardware is adequate. The plan does not promise zero lifetime business cost or cloud-quality performance on any laptop.

## 11. Make money without charging for the free core

The paid value should be finished workflows and help integrating them, rather than a thin generic chat wrapper. Prices below are experiments in INR, not established market prices or revenue forecasts.

| Offer | Free foundation | Paid deliverable | Starting price hypothesis |
| --- | --- | --- | --- |
| Developer workflow pack | Voice questions and screen explanations | Saved debug playbooks, reusable project context, structured bug-report export | Rs 499 one-time for a tested version |
| Meeting workflow pack | Questions about visible slides | Transcript-backed action lists, decision log, export templates; only after audio is reliable | Rs 999 one-time for a tested version |
| Guided local setup | Self-install guide | A remote setup session, hardware check, and one tailored workflow | Rs 1,499 per session |
| Team pilot | Individual core | Team-specific playbooks, deployment documentation, training, and bounded support | Rs 5,000 pilot for up to five users |

One-time purchases cover the advertised version and clearly stated support period, not lifetime updates. Local inference keeps our recurring compute bill low, but setup and support may dominate costs. Do not add a subscription until there is recurring value users actually request. License-code delivery can begin manually; avoid an account/payment backend for the first few customers.

First revenue experiment: publish a 60-second demo, invite five coding testers and five working developers, and let them use the free core for one week. Offer a paid tailored debug workflow/setup to users who report repeat value. Meeting teams come later. The sample is directional evidence, not a statistically representative survey.

Launch channels to try: the founder's existing network, developer community posts where allowed, and opt-in demo sessions. No paid ads needed for the first experiment. Outreach and posting remain future actions; nothing has been sent or published.

Validation gates:

1. At least five of ten testers complete setup, and at least three use it on three different days in the first week.
2. At least three describe a specific task the product helped with, supported by an example or measured time comparison.
3. Seek two real paid purchases before building billing/team infrastructure. Record declined offers and reasons too.
4. Measure support time per customer. Narrow the supported hardware/workflows if support erases the contribution from sales.
5. If people use it but will not pay for packs, test guided setup/customization. If they do not return, improve usefulness before adding features.

Illustrative arithmetic only: 10 developer-pack purchases at Rs 499 yield Rs 4,990 gross. This excludes processing fees, applicable taxes, refunds, development, and support; it is not a prediction. Keep actual sales and costs in a ledger once selling begins.

## 12. Biggest uncertainties and next action

| Uncertainty | Cheapest useful check |
| --- | --- |
| Local models too slow on target laptops | Hardware spike with timed short voice + OCR questions |
| Small model gives incorrect coding guidance | Thirty-case evaluation and narrowed supported claims |
| OCR damages code | Crop/contrast experiments, confidence checks, optional user correction |
| Users prefer existing chat apps | One-week repeat-use trial focused on context-switching benefit |
| Meeting audio misses speakers | Headphone/loopback spike before advertising catch-up summaries |
| Nobody pays | Offer an actual bounded service to repeat users before developing checkout |
| Upstream reuse adds more work than it saves | Audit seams and compare a minimal Electron shell before committing |

**Next engineering action:** finish the audit of the pinned OpenCluely reference, then build the smallest local screenshot + spoken-question loop. Defer visual polish, billing, browser extension, and continuous meeting recording until that loop is measured and useful.
