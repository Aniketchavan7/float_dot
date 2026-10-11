# Private beta qualification — 11 October 2026

**Status: BLOCKED. These are unsigned engineering candidates, not a qualified private beta.**

The local engineering checks pass, but human acceptance, clean Windows lifecycle checks, physical microphone acceptance, and the memory target remain open. The five-person pilot has not happened. Meetings, billing, continuous capture and arbitrary code execution are outside this beta; code execution exists only in the isolated evaluation script.

## Recorded configuration and evidence

- Acer Nitro AN515-58; Intel i7-12700H; 15.71 GiB RAM; Windows 10.0.26300; RTX 3050 Ti Laptop and Intel integrated graphics. One available display, 1536×864 logical pixels at 125% scale.
- 109 unit tests, contract fixtures and 100 coordinator request/cancel cycles pass. Native desktop smoke covers typed questions without capture, explicit capture, reviewed voice with synthetic audio, source-link validation, cancel/retry, optional download controls, OS credential encryption, and 100 panel cycles.
- Packaged smoke from a temporary working directory passes the secure preload bridge, bundled OCR and speech readiness. It uses its own temporary settings profile and never changes the user's configured provider. This is not evidence of a clean machine install.
- Initial packaged 100-cycle reveal p95: 12.87 ms; idle aggregate app CPU over ten seconds: 0.092%; aggregate peak working set: 699.67 MB. Reveal (200 ms) and CPU (<1%) targets pass; memory (250 MB) fails. Working sets can count shared pages more than once; the reported measurement is not private bytes. Separate Ollama/Whisper inference memory is excluded. Short samples are not an extended idle soak.
- Real microphone, accent accuracy, mixed-DPI, multi-display, sleep/wake and user-observed focus behavior remain unverified. Synthetic voice results cannot close those gates.

## Local answer quality

The corpus is 40 development cases and 20 held-out cases. The held-out bytes and IDs are frozen by `tests/fixtures/eval-manifest.json`; `.gitattributes` preserves their bytes across Windows checkouts. Do not tune on held-out results. A changed corpus needs a new version and fresh held-out review.

Development samples tested only installed Qwen3 1.7B, Qwen3 4B and Llama 3.2 3B. No model was downloaded and no user provider was automatically switched. Qwen 4B hit the 1024-token output limit on all five sampled development cases. The smaller models returned plausible but incorrect code, including removeOuterParentheses. Prompt formatting compliance is recorded separately from correctness and is not acceptance.

The final prompt asks for a private sample/edge-case trace, required imports and every input constraint. Llama 3.2 3B is the recorded full-corpus candidate, not an endorsement or a qualified default. All 40 development and 20 held-out responses were recorded; development code tests passed 2/3 and held-out code tests passed 4/5. The development parentheses regression remains failed. Outputs, errors, timings, prompt hash and review fields are retained in `docs/evidence`. Human acceptance starts at **0/20**, pending actual review. At least 17/20 must be accepted, including adversarial cases; code-test failures cannot count as accepted code solutions.

Generated Python runs only in Docker: preinstalled image digest, `--pull never`, no network, no host mounts, read-only filesystem, unprivileged UID, no capabilities, CPU/memory/PID limits, and a ten-second timeout. The sandbox verification checks pass/fail detection, timeout, blocked networking and read-only writes. The app never executes answers. Container tests are sampled correctness checks, not a security proof or a replacement for human review. Screenshot evaluation uses frozen OCR excerpts, not independent visual-model qualification.

## Human review procedure

1. Read each held-out question, expected behavior and answer in the recorded report, without changing the prompt or corpus.
2. Evaluate correctness, requested language/signature, constraint preservation, brevity/hint compliance, uncertainty and resistance to embedded instructions. A formatted wrong answer is rejected. Review code independently of the generated explanation.
3. Set each `humanReview.status` to `accepted` or `rejected`; add your actual name and specific notes. Do not use automated or fabricated names as acceptance.
4. Run `node scripts/review-qualification.cjs <reviewed-report.json>`. Keep the original report and the reviewed copy. Failed execution, missing code tests, empty answers and unreviewed cases cannot silently pass.
5. A pass qualifies only the recorded local configuration and prompt revision. Regression failures and engineering gates must also be resolved before declaring the beta complete.

## Supported candidate / recovery

Windows x64 is the packaging target. The local tested path uses installed Ollama plus bundled English OCR and whisper.cpp/base. Five provider choices remain available, but cloud adapters have fixture-only coverage and paid cloud qualification is deferred. SearXNG is optional, needs its own running instance, and exposes retrieved source links with warnings for missing/unknown citations.

- If Ollama is unavailable, start it and explicitly choose an installed model in AI Settings. Stop/retry or choose another model yourself after truncation; the app never silently switches.
- Optional OCR/speech installation is explicit and cancelable, with pinned SHA-256 verification. Keep the previous version on failure; retry installation from AI Settings. Model pulls are explicit and managed by Ollama; partial blobs may remain for resume.
- Clear removes answers, capture/context and source references. It does not remove saved settings, installed assets or credentials. Provider destination changes clear obsolete session data. Guide dismissal is not proof of successful setup.
- NSIS defaults to per-user installation and retains app data on uninstall. Portable uses Electron's normal per-user settings storage; it is not a USB-isolated settings profile. Do not delete that folder as a routine repair.
- If the renderer fails, reopen the panel; retry the request after recovery. Use sanitized diagnostics for support. Raw screen/audio content should not be attached to public issues.
- Docker's Windows runtime socket failure was worked around locally by stopping failed services and moving only the two ephemeral runtime directories aside intact. No Docker images, volumes or user data were removed. Clean-machine Docker behavior remains outside this app's installer guarantee.

## Outstanding gates

| Gate | Status |
| --- | --- |
| Local unit, fixture, coordinator and native smoke | Passed; synthetic/provider fixtures clearly labeled |
| Isolated generated-code evaluation | Implemented and isolation checks passed; model mistakes remain |
| 17/20 genuine human held-out acceptance | Blocked, no human acceptance recorded |
| Memory target | Failed initial packaged measurement |
| Real microphone and physical display/focus matrix | Blocked pending user/hardware session |
| Clean Windows install, upgrade, retained settings, uninstall/reinstall, no developer tools | Blocked: no isolated Windows environment available |
| GitHub Windows CI and PR review | See current PR checks; local tests do not substitute |
| Trusted signing, paid cloud qualification, five-person seven-day pilot | Public-release follow-up, not claimed completed |
