# Float Dot

**Ask your screen. Keep your flow.**

A floating desktop assistant: press a shortcut, ask a question with your microphone, and get an answer grounded in the window you selected. Start with coding practice and debugging; expand into meeting and document help after the core works.

Status: plan and PRD written; application implementation has not started.

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
| [PLAN.md](PLAN.md) | Product, architecture, use cases, milestones, cost model, and launch strategy |
| [BACKLOG.md](BACKLOG.md) | Ordered engineering tasks with acceptance criteria |
| [SOURCES.md](SOURCES.md) | Primary references and facts verified on 8 October 2026 |

## First demo

Open a DSA practice problem, select its window, press `Ctrl+Shift+Space`, and say: **“Give me one hint without revealing the solution.”** Float Dot transcribes locally, reads the visible text, and streams a hint into an expandable floating card. Ask **“Why does that help?”** to continue with the same context.

Shortcuts are proposals and must be configurable to avoid conflicts.

## What free means

The plan targets zero required software/API spend using a computer you already own. Model downloads, disk space, electricity, development time, and hardware are real costs. Local speed and quality need benchmarking. Income and paid demand have not been established.
