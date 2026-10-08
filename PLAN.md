# Float Dot — desktop delivery plan

Updated 8 October 2026 to reflect the owner's provider-choice and desktop-icon requirements. [PRD.md](PRD.md) is authoritative.

## Product flow

Launch floating dot -> select window/display or import screenshot -> click Read screen or speak -> review capture -> selected AI explains in the floating panel.

Users choose OpenAI, Anthropic, Gemini, an OpenAI-compatible API, or a downloaded local Ollama model. No website or Float Dot hosted backend is required. Local processing is an option; cloud usage follows the user's API account and costs.

## Delivery order

1. Desktop/provider implementation: dot-first launch, explicit window/display capture, file/clipboard screenshot input, editable provider/model, secure keys, text/image modes and correct destination labels.
2. Verification: adapter tests, synthetic desktop/API handoff, real provider-account tests, microphone/capture lifecycle and input-mode compatibility. Record latency and quality by model.
3. Usability: simplify setup, capture/crop interaction and error recovery; test keyboard use and multiple displays.
4. Distribution: validate the packaged executable outside the checkout; publish notices, quick start and actual limitations.
5. Pilot: five users, repeat-use feedback, then a paid setup/workflow experiment.

The original local-only benchmark is historical evidence, not a restriction on provider choice. Thirty-case quality, real desktop interaction and packaged distribution remain release gates. Earlier calendar estimates need re-estimation after live provider checks.
