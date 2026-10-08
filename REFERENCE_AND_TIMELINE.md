# OpenCluely reference and Float Dot timeline

Historical source inspection and original estimate. The current implementation and provider-choice scope are in PRD.md and BUILD_STATUS.md; the local-only assumptions and calendar below are superseded.

## Reference pinned locally

- Repository: [TechyCSR/OpenCluely](https://github.com/TechyCSR/OpenCluely).
- Inspected commit: [`0a9da75135f5aade3a067d86a7c8bb73f372f014`](https://github.com/TechyCSR/OpenCluely/tree/0a9da75135f5aade3a067d86a7c8bb73f372f014).
- Local read-only reference checkout: `.reference/OpenCluely/`, ignored by this project's Git configuration.
- The checkout is unmodified. No upstream install/setup scripts were run, no dependencies installed, and no upstream executable launched.
- Float Dot's public repository contains our planning documents and reference links; the ignored checkout is not shipped as product code.

Use this pinned source as the implementation reference. Adapt specific modules where they reduce work, with provenance and required notices. Avoid importing the entire application and assuming its defaults satisfy our PRD.

## Concrete reuse map

The observations below come from the pinned local files. Linked paths refer to that exact commit. This is targeted source triage, not a complete security, dependency, asset-license, or runtime audit.

| Upstream component | Observed behavior | Float Dot treatment |
| --- | --- | --- |
| [main.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/main.js) | Service orchestration, shortcuts, IPC, settings, process disguise, and Google certificate override | Reuse selected lifecycle patterns; remove disguise/certificate override; narrow orchestration and validate every public IPC |
| [preload.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/preload.js) | contextBridge interface for capture, audio chunks, and app controls | Adapt a smaller validated bridge; do not expose every upstream command |
| [window.manager.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/src/managers/window.manager.js) | Always-on-top windows; Node integration disabled and context isolation enabled; capture protection and broad window management | Reuse positioning/lifecycle ideas; build the dot/card UI, audit final preferences and sandbox/CSP/permissions |
| [capture.service.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/src/services/capture.service.js) | Enumerates screen sources, chooses display with a size heuristic, crops PNG, and can return full image on crop failure | Adapt image/metadata handling; implement explicit window IDs, correct DPI/crop bounds, preview, and fail instead of silently broadening a crop |
| [main-window.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/src/ui/main-window.js) | Renderer microphone path uses AudioContext and ScriptProcessor | Reference input lifecycle; implement tested AudioWorklet PCM path and immediate track cleanup |
| [speech.service.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/src/services/speech.service.js) | Azure/local Whisper branches, manual/VAD capture, settings and worker orchestration | Reuse useful state/error patterns; choose one local backend and remove cloud requirement from core |
| [whisper-worker.service.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/src/services/whisper-worker.service.js) and [whisper_worker.py](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/scripts/whisper_worker.py) | Persistent Python worker imports Whisper/PyTorch; request tracking and idle model unload | Reference process/request/unload design; whisper.cpp is a replacement backend, not an upstream feature already available |
| [llm.service.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/src/services/llm.service.js) | GoogleGenAI client, required Gemini key, image/transcript prompts and streamed response paths | Reuse prompt/routing ideas; replace network transport and fallback logic with a local Ollama adapter; add OCR for the text model |
| [session.manager.js](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/src/managers/session.manager.js) | In-memory conversation events, skill prompts, event-count maintenance/compression | Adapt event shape; bound tokens and source/window identity, prevent mode/context mixing, add opt-in retention separately |
| [package.json](https://github.com/TechyCSR/OpenCluely/blob/0a9da75135f5aade3a067d86a7c8bb73f372f014/package.json) | Electron 29 range; electron-builder; Unix-style start/clean scripts; Gemini/Azure dependencies | Review maintained versions; write native Windows-compatible scripts; remove unused cloud dependencies and package native-worker notices |

### New work despite reuse

Selected-window capture, OCR, local model integration, the dot/card UX, reliable cancellation across all workers, local-only onboarding, corpus evaluation, and meeting loopback audio remain real engineering tasks. The upstream app provides implementation patterns; it does not provide an already-finished free Float Dot.

The upstream capture service's display selection is different from window enumeration found elsewhere in its window manager. A source list elsewhere does not establish that the screenshot pipeline already captures the selected window.

### Remaining audit before adapting code

1. Verify full runtime/asset/model/dependency licenses at the pinned commit. LICENSE contains Apache 2.0 while README and manifest labels differ; retain required attribution and mark copied/modified files appropriately.
2. Inspect renderer output handling, every reused IPC entry, logger payloads, process launch arguments, cleanup, persistence, and capture-permission behavior.
3. Review setup/postinstall/build scripts before running them; enumerate remote downloads and pin their provenance.
4. Benchmark candidate services on actual target hardware; no estimate below establishes measured throughput.
5. Document imported modules in a provenance file when importing starts. The current reference checkout is not a dependency or release asset.

FD-001 has reference pinning and source triage complete; full audit remains open.

## Effort estimate for the free MVP

One developer, Windows 11 x64, one local text model, one transcription backend, English technical speech, no meeting audio/vision/browser extension/billing backend. Includes integration and modest rework allowance; serious hardware/native-tool problems can extend the range.

| Stage | Focused hours | Deliverable | Required evidence |
| --- | --- | --- | --- |
| Audit and feasibility spike | 12-18 | Upstream reuse decisions; ASR/OCR/model benchmarks | One useful local request and recorded hardware/results |
| Local pipeline integration | 24-36 | PCM audio, whisper.cpp, OCR, Ollama streaming | Voice + selected context produces local answer and can stop |
| Desktop experience | 20-30 | Dot/card, window chooser, preview, follow-ups and settings | Repeatable source selection, no stale-context crossover |
| Modes and reliability | 18-26 | DSA/debug/general modes, request coordination, renderer/data boundaries | Hint progression, failure/cancellation/cleanup checks |
| Onboarding, evaluation and build | 20-30 | Portable build, dependency setup guide, thirty-case report | Core works offline outside the developer checkout |
| **MVP engineering total** | **94-140** | **Testable free MVP** | **PRD MVP gates pass** |

A rough demonstration can appear after about 16-24 focused hours, typically 3-5 working days when enough daily time is available. It is an interim milestone within the total, not extra effort. Expect manual dependencies and incomplete usability in that demonstration.

## Calendar timeline by available time

| Available focused time | Testable MVP engineering | Add tester/pilot feedback | Approximate launch experiment |
| --- | --- | --- | --- |
| 25 hours/week | 4-6 weeks | About 1 week | 5-7 weeks |
| 15 hours/week | 7-10 weeks | About 1 week | 8-11 weeks |
| 10 hours/week | 10-14 weeks | About 1 week | 11-15 weeks |

Calendar estimates are rounded effort divided by weekly availability. Tester recruitment/setup may overlap development, but customer responses can also take longer. A paid pilot is an experiment, not a guaranteed first-sale date.

At 25 hours/week, a reasonable sequence is:

- Week 1: source audit, local feasibility, and a rough demonstration if the spike passes.
- Weeks 2-3: local adapter/audio/OCR integration plus dot/card and selected-window flow.
- Week 4: modes, follow-ups, cancellation, privacy boundaries, and quality evaluation.
- Weeks 5-6 if needed: setup/package issues, failures found by testers, performance refinements and release gate completion.
- Following week: observed repeat use and a concrete paid setup/workflow offer.

Stop adding polish when a core gate fails. Resolve the local performance/capture/data-lifecycle problem before expanding scope. Re-estimate after the feasibility spike and again after three testers install the package.

## Add-on timelines after the MVP

These are additional effort ranges and assume the MVP is stable. Native audio and language-quality problems may exceed them.

| Add-on | Extra focused hours | At 25 hours/week | Scope |
| --- | --- | --- | --- |
| Spoken responses and reviewed exports | 8-16 | Less than 1 week | Verified local voice, playback interruption, explicit export |
| Meeting transcript and summaries | 40-80 | 2-4 weeks | Mic + tested Windows loopback, timestamps, retention, long-session evaluation; no reliable speaker naming promised |
| Local chart/diagram understanding | 16-30 | 1-2 weeks | Vision-model integration, separate license/hardware/quality evaluation |
| Browser page-text extension | 24-40 | 1-2 weeks | Scoped tab permissions, app connection and tab/frame checks |
| Paid workflow/setup pilot | Scope-dependent | Feedback week plus service delivery | Manual sale/delivery first; automated billing only after demand |

## Revision to the original estimate

The earlier plan proposed about five weeks at 10-15 hours/week, or only 50-75 focused hours. That was optimistic for all its release gates. Inspecting the actual reference confirms that selected-window capture, OCR, local-provider replacement, Python-to-whisper.cpp adaptation, and packaging/quality work still have to be built.

Use **94-140 focused hours for the testable MVP**, or **4-6 weeks at 25 hours/week**, as the current planning baseline. Reuse should shorten discovery and some lifecycle/UI work, but no percentage savings or fixed completion date can be justified before integration benchmarks.
