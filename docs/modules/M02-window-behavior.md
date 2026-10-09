# M02 — Native window behavior

**Suggested owner:** Codex-assisted · **Estimate:** 4–6 days · **Dependencies:** M00; integrate M01

Outcome: the assistant stays available without interrupting the user's working window.

**9 October implementation:** built; automated/native smoke verified. Physical release checks below remain open. See [verification and API handoff](../M02_M03_VERIFICATION.md).

Entry: window creation, shortcuts and tray code in `src/main/index.js`. Proposed boundary: `src/main/window-manager.js`.

- [x] Remove repeated startup show/focus behavior. Launch the compact toolbar; show setup when configuration needs attention.
- [x] Separate show-without-focus, open-for-typing, collapse, hide and quit actions.
- [x] Preserve placement in DIP and pin state; clamp on restart, display changes and resume. Height follows visible content.
- [x] Implement toolbar/dot drag regions, pin, Escape and tray actions; shrink the native rectangle with content.
- [x] Keep the working shortcut on conflict; show an actionable error and retain the editable shortcut field.
- [ ] Verify shadow/transparency, maximized-app behavior, taskbar/tray behavior, sleep/wake and renderer recovery.

**Complete when:** zero focus theft in 30 passive answer updates during editor typing; 100 open/collapse cycles work; dual monitors with negative coordinates and mixed DPI recover; closing settings does not unexpectedly quit the app. Explicit Quit releases all resources.

**Handoff:** physical desktop test matrix, placement migration notes and native window API contract. Per-pixel passthrough and universal screen-share hiding are outside this module.
