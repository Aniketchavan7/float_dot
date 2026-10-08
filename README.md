# Float Dot

**Ask your screen. Keep your flow.**

A floating desktop assistant: press a shortcut, ask a question with your microphone, and get an answer grounded in the window you selected. Start with coding practice and debugging; expand into meeting and document help after the core works.

Status: Core prototype implemented with passing test suite (17/17 tests), desktop speech verification, 30-case evaluation corpus, meeting mode (rolling transcript & action-item extractor), and verified portable packaging. See [BUILD_STATUS.md](BUILD_STATUS.md).

## Run the application (Windows x64)

Use Node.js 24 or newer and an installed Ollama runtime. From this repository:

```powershell
npm ci
npm run setup:local
```

Start the local model server in a separate PowerShell terminal:

```powershell
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

If Ollama is already running, configure/restart that instance deliberately rather than starting a second server. Then, in the project terminal:

```powershell
ollama pull qwen3:4b
npm run check:local
npm start
```

First setup downloads free OCR/speech assets and roughly 2.5 GB of model weights. Subsequent content processing uses local assets and the loopback model API. These assets and dependencies are not committed to Git.

Choose a window and a mode (DSA hints, Debug, Explain, or Meeting). Click **Ask with voice**, speak, then click again to stop. Review the captured image/text and recognized question, then request the answer. **Read screen** supports a typed diagnostic question. Voice follow-ups can reuse the current capture. The collapse button opens a floating dot; click the dot to reopen.

In **Meeting mode**, Float Dot listens to room audio through your microphone, streams a live timestamped rolling transcript, and allows you to summarize confirmed decisions, extract action items with citations, and export markdown meeting notes.

The current shortcut is fixed at `Ctrl+Shift+Space`.

## Verification & testing

```powershell
npm test             # Run 17 unit and integration tests
npm run test:audio   # Verify Whisper runtime with synthetic WAV audio
npm run test:eval    # Run live end-to-end AI evaluation against Ollama
npm run smoke        # Run automated Electron UI, AudioWorklet, and OCR smoke test
npm run pack         # Package Windows standalone portable app into dist\win-unpacked
```

Packaging produces an unpacked portable application (`dist/win-unpacked/Float Dot.exe`). Live AI inference on local quantized models (Qwen3 4B) operates offline with warm TTFB ~930ms–1029ms on supported hardware.

## Decisions

- Windows first, using selected-window capture and push-to-talk.
- Local speech, local OCR, and local reasoning by default.
- No required paid APIs, account, server, subscription, or domain for the core prototype.
- A permanently free core; revenue experiments around workflow packs, setup, and team customization.
- Adapt useful OpenCluely components after an audit rather than treating the upstream app as production-ready.

## Read the plan

| File | Purpose |
| --- | --- |
| [PRD.md](PRD.md) | Complete product requirements, proposed tech stack, user journeys, data limits, and acceptance criteria |
| [BUILD_STATUS.md](BUILD_STATUS.md) | Implemented prototype features, actual verification, and current status |
| [PROVENANCE.md](PROVENANCE.md) | Code-reference and dependency/asset provenance |
| [REFERENCE_AND_TIMELINE.md](REFERENCE_AND_TIMELINE.md) | Pinned OpenCluely reference, concrete reuse map, and revised effort/calendar estimates |
| [PLAN.md](PLAN.md) | Product, architecture, use cases, milestones, cost model, and launch strategy |
| [BACKLOG.md](BACKLOG.md) | Ordered engineering tasks with acceptance criteria |
| [SOURCES.md](SOURCES.md) | Primary references and facts verified on 8 October 2026 |

## First demo

Open a DSA practice problem, select its window, press `Ctrl+Shift+Space`, and say: **“Give me one hint without revealing the solution.”** Float Dot transcribes locally, reads the visible text, and streams a hint into an expandable floating card. Ask **“Why does that help?”** to continue with the same context.

## What free means

The plan targets zero required software/API spend using a computer you already own. Model downloads, disk space, electricity, development time, and hardware are real costs. Local speed and quality need benchmarking. Income and paid demand have not been established.
