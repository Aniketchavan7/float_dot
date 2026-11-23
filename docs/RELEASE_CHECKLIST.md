# Windows release checklist

The private beta is **not complete** until the engineering and local quality gates pass. See [recorded evidence and blockers](BETA_QUALIFICATION.md) and [module audit](MODULE_IMPLEMENTATION_AUDIT.md).

## Build from a clean committed revision

Use Node 22+ on Windows x64. Run `npm ci`, `npm run setup:local`, `npm test`, `npm run test:fixtures`, `npm run test:soak`, `node scripts/prepare-smoke-profile.cjs`, `npm run smoke`, `npm run build:win`, then `npm run release:checksums`. Setup downloads OCR/speech assets; it does not download an Ollama model. Local qualification only uses installed models.

Deliver `Float Dot-0.1.0-x64-Setup.exe`, `Float Dot-0.1.0-x64-Portable.exe`, `SHA256SUMS.txt`, `release-manifest.json`, changelog and notices. A dirty-source manifest is not acceptable as a final-source candidate. Electron-builder's "signing" log is not proof of a trusted signature. CI uploads job artifacts and never publishes a release.

## Required private-beta gates

- [ ] Reviewed PR with passing Windows CI on its latest source revision.
- [ ] At least 17/20 genuinely human-accepted frozen answers for one installed local configuration; reject failed code tests.
- [ ] Performance budgets, full native stability, physical microphone and available display/focus checks.
- [ ] Clean Windows x64 VM: NSIS install, launch without repository/developer tools, optional setup, upgrade preserving settings, uninstall, reinstall.
- [ ] Portable launch and explicitly documented per-user settings behavior.
- [ ] Checksums and source manifest match final artifacts; provenance, dependency notices, support/recovery instructions included.

No VM lifecycle test has passed merely because the executable builds or launches locally. No synthetic microphone test closes physical voice acceptance.

## Public-release follow-up

- [ ] Trusted Authenticode signing and publisher verification.
- [ ] Live paid-provider text/image qualification with authorized accounts.
- [ ] Five-person seven-day pilot, support triage, no unresolved critical/high issue and explicit release decision.

Pilot materials are prepared in PILOT_GUIDE.md; the pilot has not been conducted. Uninstall intentionally retains app data. Clear resets the current session and sources, not credentials or downloaded components.
