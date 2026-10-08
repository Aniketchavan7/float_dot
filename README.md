# Float Dot

**Ask your screen. Keep your flow.**

A floating desktop assistant: press a shortcut, ask a question with your microphone, and get an answer grounded in the window you selected. Start with coding practice and debugging; expand into meeting and document help after the core works.

Status: first prototype implemented; desktop microphone verification, answer quality/performance, and release packaging remain unfinished. See [BUILD_STATUS.md](BUILD_STATUS.md).

## Run the prototype (Windows x64)

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

First setup downloads free OCR/speech assets and roughly 2.5 GB of model weights. The first Electron launch may download its desktop runtime. Subsequent content processing uses local assets and the loopback model API. These assets and dependencies are not committed to Git.

Choose a window and a mode. Click **Ask with voice**, speak, then click again to stop. Review the captured image/text and recognized question, then request the answer. **Read screen** supports a typed diagnostic question. Voice follow-ups can reuse the current capture. The collapse button opens a floating dot; click the dot to reopen.

The current shortcut is fixed at Ctrl+Shift+Space. Crop selection and configurable shortcuts are planned, not completed. Meeting audio is not implemented.

## Verify

```powershell
npm test
npm run smoke
```

The smoke test uses synthetic browser microphone input and a temporary sample window; it does not record your real microphone. It currently needs further debugging. The integration check can use locally generated synthetic fixtures:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/create-speech-fixture.ps1
node scripts/verify-local.cjs
```

Prototype limitation: the initial local AI run was slow and returned an unsuitable verbose response. Do not treat a running model as proof the assistant is ready for daily use. Packaging scripts are present but no validated installer/release has been produced.

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
| [BUILD_STATUS.md](BUILD_STATUS.md) | Implemented prototype features, actual verification, and current blockers |
| [PROVENANCE.md](PROVENANCE.md) | Code-reference and dependency/asset provenance |
| [REFERENCE_AND_TIMELINE.md](REFERENCE_AND_TIMELINE.md) | Pinned OpenCluely reference, concrete reuse map, and revised effort/calendar estimates |
| [PLAN.md](PLAN.md) | Product, architecture, use cases, milestones, cost model, and launch strategy |
| [BACKLOG.md](BACKLOG.md) | Ordered engineering tasks with acceptance criteria |
| [SOURCES.md](SOURCES.md) | Primary references and facts verified on 8 October 2026 |

## First demo

Open a DSA practice problem, select its window, press `Ctrl+Shift+Space`, and say: **“Give me one hint without revealing the solution.”** Float Dot transcribes locally, reads the visible text, and streams a hint into an expandable floating card. Ask **“Why does that help?”** to continue with the same context.

The scenario above is the target experience; live microphone and end-to-end usability verification are still incomplete.

## What free means

The plan targets zero required software/API spend using a computer you already own. Model downloads, disk space, electricity, development time, and hardware are real costs. Local speed and quality need benchmarking. Income and paid demand have not been established.
