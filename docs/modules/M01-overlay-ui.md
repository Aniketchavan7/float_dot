# M01 — Minimal overlay UI

**Suggested owner:** Aniket · **Estimate:** 3–5 days · **Dependencies:** M00

Outcome: a toolbar and answer card that feel comfortable above an editor or browser.

Entry files: `src/renderer/index.html`, `styles.css`, `app.js`. Proposed extraction: `src/renderer/overlay.js` and `answer-view.js`. Native window placement belongs to M02.

- [x] Replace the tall default dashboard with the small toolbar described in the shipping plan (compact `.toolbar-capsule`).
- [x] Keep Read screen, microphone and overflow visible. Move settings, import, export and intent selection into deliberate disclosure (`#overflow-menu`).
- [x] Show an answer card only when needed; answer first, expandable evidence, follow-up input and Copy (`#answer-section`, `AnswerView`).
- [x] Implement idle/working/answer/error states against M00 fixtures; keep Stop accessible (in toolbar capsule and answer header).
- [x] Add opacity controls, readable dark/light/opaque surfaces, keyboard focus, reduced motion and text scaling.
- [x] Prevent streaming reflow from moving the toolbar, resetting scroll position or losing text selection. Long code scrolls horizontally inside its block (`pre code` with `overflow-x: auto`).
- [x] Keep source/time and provider destination available without a permanent large metadata section (concise header pill).

**Complete when:** all fixture states fit at 1366×768 and at 200% scaling; keyboard-only use reaches every action; a long answer, table, code block and error do not expand beyond the agreed display bound. Validate contrast over both bright and dark underlying windows.

**Status:** Completed (9 Oct 2026). Extracted `src/renderer/overlay.js` and `src/renderer/answer-view.js`. Updated `index.html` and `styles.css`. Smoke test and unit tests 52/52 passing. Ready for M02.
