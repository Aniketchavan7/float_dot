# Module implementation audit — 11 October 2026

This audit supersedes earlier blanket "built and pilot-ready" claims. Implemented features and release qualification are different.

| Module | Current implementation | Remaining evidence / work |
| --- | --- | --- |
| M00 | Shared contracts, request isolation and fixture runner | Extend fixtures when event contracts change |
| M01 | Compact toolbar, answer card, intent controls, opacity/theme, copy and stop | Physical contrast/keyboard/scaling acceptance |
| M02 | Passive window behavior, tray, placement, shortcuts and crash reload | Mixed-DPI, sleep/wake and physical focus matrix |
| M03 | Explicit screen/region/file/clipboard capture; preview and OCR/image routing | Physical capture matrix; arbitrary models remain provider-validated |
| M04 | Microphone lifecycle, silence checks, transcript review, cancellation | Two accents and 20 real microphone recordings |
| M05 | Context isolation; code requests, hints in any mode, code-only and short-answer format overrides | Held-out human correctness gate; current small local model is unqualified |
| M06 | Five provider adapters, explicit connection test, model selection, encrypted keys, local model download | Live cloud text/image matrix with configured accounts; heuristic capability detection is not proof |
| M07 | First-run guide, persisted setup completion, actual configured shortcut, optional GUI OCR/speech installs, Ollama download link and model download | Fresh-user five-minute test; Ollama itself is installed using its official installer |
| M08 | Sender checks, cancellation, bounded history, Clear removes retained source links, sanitized diagnostics | Physical performance measurement and full release privacy audit |
| M09 | NSIS + portable targets, verified asset downloads, minimal runtime packaging, Windows CI workflow, release manifest/checksums | CI execution after push; signing; clean Windows install/upgrade/uninstall matrix |
| M10 | Pilot guide and feedback protocol | Five actual testers over seven days, support triage and launch decision |

## Added in this implementation pass

- AI Settings installs optional English OCR and local speech without a terminal. Downloads are explicit, streamed, cancelable and SHA-256 verified. Installation uses versioned directories under the app user-data folder, preserving the previous working version until the new version is complete.
- Existing setup script also verifies existing files and pins every download by content hash. OCR/speech license files accompany their assets.
- Local models download through the loopback Ollama API with progress and cancellation. It never switches the active provider automatically. Large downloads are disclosed; stopped downloads may leave Ollama-managed partial blobs for retry.
- A configured text provider is sufficient for onboarding readiness; missing optional OCR cannot block chat. Explain is the new-install default; existing saved preferences stay intact.
- Explicit code-only and sentence-count requests override the default heading template; explicit hints work in all coding modes. These changes improve instruction framing, not proof of model correctness.
- Windows builds produce distinct installer/portable files. The installer defaults to per-user and preserves app data on uninstall. Runtime packaging excludes unused speech sample/test executables.
- `.github/workflows/windows.yml` runs unit/fixture/soak/native smoke checks and builds unsigned beta artifacts. No publication or signing occurs automatically.

## Verification

109 unit tests passed. Fixtures passed; 100 coordinator request/cancel cycles passed. Native desktop smoke passed after UI integration. A real OCR download passed its hash check. Speech archive verification and native extraction passed using the already cached verified assets, and the resulting speech service reported ready. Neither test used a paid API.

The soak test checks coordinator behavior, not all native resources or the full performance budgets. A passing fixture/prompt test does not prove resistance to every prompt injection or algorithmic correctness. See the release checklist for external gates.

## Private-beta gate update

See BETA_QUALIFICATION.md for full evidence and blockers. M00 now includes request-scoped download and source fixtures. M05 has 40 development and 20 frozen held-out cases, isolated code tests and pending genuine human acceptance. M07 retains unsaved settings and distinguishes guide dismissal from setup success. M08 packaged reveal/CPU checks passed; the initial 699.67 MB aggregate working set failed the 250 MB target. M09 builds unsigned NSIS/portable candidates; clean Windows lifecycle checks remain blocked. M10 materials are prepared, but no pilot has happened.
