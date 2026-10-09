# M07 — Onboarding and settings

**Status:** Built & Verified · **Owner:** Aniket · **Dependencies:** M00; integrated M01/M06

Outcome: a new user reaches their first answer without a terminal or developer help.

Entry: `src/renderer/settings-view.js`, `settings.js`, `index.html`, `styles.css`.

- [x] First-run choice: local Ollama or a cloud/compatible provider. Plain-language explanation of where content goes and privacy boundaries.
- [x] Make downloads conditional: cloud image/text entry does not require a local language model; microphone use requires speech assets; OCR mode requires OCR assets.
- [x] Provide progress, readiness indicators, and capability badges (Vision, Reasoning, Local, Embedding warning).
- [x] Build a short first-use guide for Read screen (`Alt+Shift+S`), voice (`Ctrl+Shift+Space`), Stop, collapse (`Esc`) and tray recovery.
- [x] Offer microphone, shortcuts, opacity, theme, capture review and model settings in the separate settings drawer.
- [x] Extracted modular `SettingsView` (`src/renderer/settings-view.js`) with synthetic DOM tests.

**Complete when:** fresh users reach a first answer within five minutes after prerequisites/downloads are available; they can identify the current provider and cancel recording without guidance.

**Verification:**
- `tests/settings-view.test.cjs`: First-run detection, path selection, and `onBeforeSave` hook.
- All 89 unit tests pass (`npm test`).
