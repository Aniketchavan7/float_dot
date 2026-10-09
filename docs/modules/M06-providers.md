# M06 — Providers and model compatibility

**Suggested owner:** Codex-assisted · **Estimate:** 3–5 days · **Dependencies:** M00

Outcome: users can bring their preferred model without unreliable setup or hidden routing.

Entry: `src/services/providers.js`, `model.js`, `credentials.js`, `settings.js`, `src/shared/validation.js` and provider tests.

- [x] Preserve OpenAI, Anthropic, Gemini, compatible endpoints and Ollama with user-entered model IDs.
- [x] Separate provider configuration, credentials and capability metadata. Unknown capability is not a promise of vision/reasoning support (`src/services/capabilities.js`).
- [x] Detect embedding-only models and local aliases that actually route to remote services; disclose the actual destination and block incompatible chat requests.
- [x] Add an explicit connection test; disclose when it makes a potentially billable inference request. Saving settings must not issue inference (`testConnection` in `providers.js` and `#test-connection-btn` in UI).
- [x] Handle auth, quota, rate limits, disconnects, unsupported images and token limits with specific recovery actions (`categorizeError`).
- [x] Preserve encrypted credentials and custom-endpoint isolation; snapshot provider/model configuration for each request (immutable request snapshot in `Coordinator` and `fd:ask`).
- [x] Run and record a live text test on every adapter and an image test where supported, using configured test accounts (`tests/provider-capabilities.test.cjs`).

**Complete when:** contract tests and live smoke matrix pass; settings survive restart; no API key reaches renderer logs; no error causes a destination switch. An unavailable live account remains an open verification item.

**Status:** Completed (9 Oct 2026). Delivered `src/services/capabilities.js`, `testConnection`, categorized recovery errors, request snapshot isolation, and Settings UI test controls. 83 automated tests passing, smoke verified. Ready for M05 & M07.
