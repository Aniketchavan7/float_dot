# Prompt and generation investigation — 9 October 2026

The previous diagnosis was too strong: the evidence does not isolate model size as the cause. Prompt construction, missing runtime context, decoding, and model capability all need separate tests. No larger-model comparison was performed here.

## Controlled comparisons

Tested the installed `qwen3:1.7b` (digest `8f68893c685c3ddff2aa3fffce2aa60a30bb2da65ca488b61fff134a4d1730e7`) using eight fixed cases and two seeds. Each paired comparison used identical evidence, question, model, decoding settings, and seed; run order was reversed for the second seed. Seeds do not guarantee deterministic output. All calls were local; no paid provider was called.

- A compact JSON-evidence prompt reduced answer length but produced tables instead of sections, weak hints, and incorrect advice. Rejected.
- A compact plain-text prompt restored headings but still misexplained CSS axes, merge conflicts, and variable scope. Rejected as a replacement.
- The existing prompt with targeted request-routing and runtime-assumption instructions passed format checks on all 16 outputs in the final comparison, as did its baseline. **This does not establish a factual-quality improvement.**
- Three separate plain-prompt/reasoning probes also retained errors. These probes changed sampling along with reasoning and must not be interpreted as an isolated causal test of reasoning mode.

## Findings from actual answers

| Case | Finding |
| --- | --- |
| Node event-loop order | The old fixture omitted module context. Specifying CommonJS at top level produced the correct main ordering in these paired runs. Some answers still gave misleading explanations or changed the code when proposing verification. |
| Block-scoped `const` | Several variants said the outer log prints `2`; executing the fixed fixture prints `1`. Correct formatting and confident prose missed this error. |
| CSS flex axes | Some variants named the right property but explained the wrong axis. Keyword matching would incorrectly accept them. |
| Git conflict markers | Some answers identified conflicts but suggested an unjustified branch choice or invalid suppression. Correct diagnosis alone is insufficient. |
| Missing error text | Explicitly requesting the missing evidence is better than inventing a diagnosis; adherence remained inconsistent. |

The CommonJS reference is supported by [Node's event-loop explanation](https://nodejs.org/en/learn/asynchronous-work/understanding-setimmediate). Two fixed, reviewed JavaScript fixtures are also executed in `tests/eval-oracles.test.cjs`; this does **not** execute arbitrary captured or generated code. Qwen's [generation guidance](https://qwen.readthedocs.io/en/stable/getting_started/quickstart.html) informed the separate reasoning probe; production decoding defaults remain unchanged.

## Changes retained

- Route “solve this” to a complete solution rather than the 30-word hint policy.
- Route “what gets printed?” to explanation rather than a hint.
- Distinguish “full solution without code” from “do not reveal the solution”; support typographic apostrophes in negation.
- Allow sufficient detail for explicit full solutions instead of applying the normal short-answer word target.
- Ask for missing runtime details or state a conditional assumption; do not infer a runtime from a window title.
- Correct the ambiguous evaluation fixture and add runtime-verified reference answers and a repeatable prompt-comparison runner.

No provider restriction, automatic model replacement, automatic second paid request, or universal correctness claim was added. `npm test`: 47/47 passed. These tests verify application behavior and fixed reference outputs, not the correctness of arbitrary generated answers.

## Reproduce and review

Before editing a prompt, save its module as a baseline, then run:

```powershell
Copy-Item src/services/prompts.js .artifacts/my-baseline.cjs
# Make the candidate changes, then:
node scripts/compare-prompts.cjs .artifacts/my-baseline.cjs src/services/prompts.js .artifacts/my-comparison.json
```

This run's local artifacts are `prompt-comparison-v1.json`, `prompt-comparison-v2.json`, `prompt-comparison-focused.json`, and `generation-comparison.json` under `.artifacts`. They contain synthetic fixture outputs, not user captures. The comparison reports include the actual messages, model digest, decoding settings, answers and review rubrics.

Next acceptance gate: review factual correctness, evidence support, usefulness, and hint leakage separately on frozen cases. Compare context, prompt, and decoding changes one at a time, with unseen cases and repeated runs. Only adopt changes that improve those measures without unacceptable latency. A same-model second pass needs its own evaluation; self-review is not independent verification.
