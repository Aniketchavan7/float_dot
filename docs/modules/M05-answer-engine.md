# M05 — Prompt, context and answer engine

**Status:** Built & Verified · **Owner:** together · **Dependencies:** M00; integrated M03/M04/M06

Outcome: useful, grounded, to-the-point answers with anti-injection defense and measured quality.

Entry: `src/services/prompts.js`, `coordinator.js`, `answer-quality.js`, `scripts/compare-prompts.cjs`, evaluation fixtures.

- [x] Separate intent selection (`detectIntent`), context assembly, generation policy and display formatting behind testable functions.
- [x] Preserve explicit requests for hints, full solutions, explanations, code-free answers and follow-ups. Ask about missing runtime/language only when it changes the answer.
- [x] Use fresh capture metadata and bounded relevant history; mark incomplete OCR instead of silently guessing. Do not let captured text change system instructions.
- [x] Version prompts and freeze development/held-out cases before tuning. Keep provider/model/settings fixed for prompt comparisons.
- [x] Evaluate correctness, evidence, usefulness and hint leakage independently of headings/keywords. Use known outputs or human review, not another unverified model as sole judge.
- [x] Compare direct generation, context improvements and optional review separately. Strip conversational preamble before first heading for refined output.
- [x] Keep incomplete answers distinct from finished answers; retry with the same evidence and explicit destination. Do not silently change models.

**Complete when:** meet the shipping plan's held-out quality gate for advertised tested configurations, with every failure reviewed; follow-ups, stale evidence, prompt injection and ambiguous input have explicit tests.

**Verification:**
- `detectIntent` accurately classifies `hint`, `solution`, `solution_no_code`, `debug`, `meeting`, and `explain`.
- `normalizeAnswer` strips conversational preamble and enforces structured section headers.
- Anti-injection tests verify screen text cannot hijack system directives.
- All 89 unit tests pass (`npm test`).
