# M02 / M03 implementation handoff

Date: 9 October 2026. Implementation is ready for desktop testing; this is not a release certification.

## Baseline and verification

Before changes: 52/52 tests, contract fixtures and existing Electron smoke passed.

After changes: 64/64 tests and contract fixtures pass. Extended Electron smoke exercises the actual secure renderer and native windows with synthetic content. The tests use no paid API and do not modify the user's clipboard.

| Coverage | Result / limits |
| --- | --- |
| Passive native windows | 100 collapse/expand cycles, 30 resizes and 30 streamed answer updates; focus event counter stays zero and synthetic editor remains focused |
| Compact sizing | Closing settings shrinks native bounds to content; idle target 70 DIP, Windows reports 71 at 125% scaling (native pixel rounding) |
| Region selector | Actual mouse drag and Escape input through isolated preload/IPC; primary display at 125%; only synthetic screenshot shown |
| Crop geometry | Unit tests at 100/125/150/200%, actual bitmap dimensions, invalid/out-of-bounds selection |
| Placement | Disk save/reload, pin persistence, negative-coordinate monitor and disconnected-monitor clamping |
| Cancellation | Selector cancel, abort during capture, queued abort, later hide/collapse not undone by capture completion |
| Inputs | Real Electron window capture/OCR; native image decode of PNG file; clipboard adapter supplying native image; canceled file dialog adapter |
| Capture review | Actual renderer Read action shows preview and extracted evidence before confirmation; Discard clears it |
| Existing behavior | AudioWorklet fake microphone, structured Markdown/table/code, sanitized answer HTML, mock provider image upload, OS key encryption |

Run `npm test`, `npm run test:fixtures`, and `npm run smoke`. Smoke images in `.artifacts`: `compact-smoke.png`, `review-smoke.png`, `answer-smoke.png`. These are synthetic fixtures, not user screen recordings.

`npm run pack` passed after the final changes. Local runnable output: `dist/win-unpacked/Float Dot.exe`. This verifies packaging, not clean-machine installation or code-signing trust. Default app icon/author metadata remain distribution work.

## How to use

- Toolbar brand area drags the panel. Overflow contains pin, collapse, hide and quit. Drag the collapsed dot's outer ring; click its center to reopen.
- Tray Show is passive. Tray Open for typing deliberately focuses the input. Escape cancels active work, closes an open drawer, or collapses an idle panel.
- Choose a display in Sources, then Region. Drag an area, Escape cancels, Enter uses the whole selected display. A window source must be changed to a display before Region.
- Read captures the selected window/display. File and clipboard remain deliberate actions. Review can inspect thumbnail and OCR text before sending.

## Boundaries and persistence

`src/main/window-manager.js` owns native bounds, visibility, pin, atomic placement storage and shortcut replacement. Existing app IPC remains available; added `fd:layout {height}`, `fd:pin boolean`, `fd:hide`, `fd:focus`. Passive show never calls focus. Layout accepts finite bounded height and clamps to work area.

`window-state.json` in Electron userData is additive; existing settings need no migration. It stores panel/dot DIP bounds and pin. Panel content height is recalculated rather than reopening the last tall answer. Invalid placement data resets safely. Display events and resume clamp current placement.

`src/services/capture.js` owns source listing, capture serialization, imports and region-to-bitmap mapping. `capture(input, signal)` / `importImage(kind, signal)` return packed buffer, bounded preview, dimensions, name, sourceId and optional crop; cancel returns null or AbortError. Exact source IDs are preserved; unavailable sources never silently fall back. Main keeps the full image and assigns each import a unique capture/session identity.

Region selection uses a separate sandboxed window/preload. Its IPC checks the sender, main frame, app URL and per-selection nonce. Regions are validated against the selected display and bitmap. Selection is one display at a time.

Known Ollama capabilities are checked before image capture; text-only models get an OCR/vision recovery message. Arbitrary cloud/custom IDs cannot be inferred reliably from names: complete those capability checks with M06. No automatic provider fallback is introduced.

## Remaining physical release checks

- Two physical monitors with negative coordinates and mixed scaling; unplug/replug while panel or selector is open.
- Sleep/wake, maximized editor/browser, taskbar/tray recovery, pin/unpin and drag on each monitor, transparency and renderer-crash recovery.
- Real display capture self-exclusion, native file picker and real clipboard input; blank/low-resolution screenshots, long code, multi-display selection alignment.
- Human typing during passive updates. Synthetic focus checks passed; they do not substitute for a human desktop session.
- Cloud model capability setup, clean-machine installer and shipping hardening remain later-module work.

Keep M02/M03 marked implemented with verification pending until these checks are recorded. M04 voice reliability is the next engineering module; M07 onboarding can proceed independently.
