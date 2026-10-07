# Verified primary references

Checked on 8 October 2026. These links support technical feasibility and licensing observations. Product demand, revenue, hardware targets, and delivery estimates in the plan are hypotheses; they have not been verified by these sources. Upstream branches and model tags are mutable, so pin versions during implementation.

OpenCluely source inspection is now pinned to commit [`0a9da75135f5aade3a067d86a7c8bb73f372f014`](https://github.com/TechyCSR/OpenCluely/tree/0a9da75135f5aade3a067d86a7c8bb73f372f014). The local checkout can differ from web-cached main-branch pages. See [REFERENCE_AND_TIMELINE.md](REFERENCE_AND_TIMELINE.md) for exact file links and observations.

| Reference | What it establishes |
| --- | --- |
| [OpenCluely repository](https://github.com/TechyCSR/OpenCluely) | Public source and existing desktop assistant context |
| [OpenCluely main.js](https://github.com/TechyCSR/OpenCluely/blob/main/main.js) | Imports separate capture, speech, LLM, window, and session components |
| [OpenCluely package.json](https://github.com/TechyCSR/OpenCluely/blob/main/package.json) | Electron/JavaScript stack, Gemini dependency, build scripts, and ISC metadata |
| [OpenCluely LICENSE](https://github.com/TechyCSR/OpenCluely/blob/main/LICENSE) | Apache 2.0 text; differs from README/manifest labels |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Local speech recognition, CPU inference, Windows support, MIT runtime license |
| [Ollama API introduction](https://docs.ollama.com/api/introduction) | Local endpoint and local requests without an API key |
| [Ollama FAQ](https://docs.ollama.com/faq) | Runtime configuration and local/cloud behavior to review for offline mode |
| [Ollama license](https://github.com/ollama/ollama/blob/main/LICENSE) | MIT license for runtime; model terms are separate |
| [Qwen3-4B model card](https://huggingface.co/Qwen/Qwen3-4B) | Text model, Apache 2.0 designation, and thinking/non-thinking behavior |
| [Qwen3:4b Ollama tag](https://ollama.com/library/qwen3:4b) | A downloadable quantized candidate; currently about 2.5 GB |
| [Tesseract](https://github.com/tesseract-ocr/tesseract) | Local OCR engine and Apache 2.0 runtime license |
| [Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3) | Optional image-capable model variants and model-specific conditions |
| [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) | Renderer isolation/sandboxing, IPC validation, permissions, navigation and CSP guidance |
| [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer) | Window/screen source enumeration and capture thumbnail sizing |
| [Ollama chat API](https://docs.ollama.com/api/chat) | Streaming, thinking controls, model-specific capabilities and keep-alive settings |
| [Tesseract tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) | Fast OCR trained data with Apache 2.0 licensing and accuracy/speed tradeoffs |
| [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) | Audio processing thread and secure-context requirements |
| [SpeechSynthesisVoice localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService) | Local versus remote voice indication, to combine with offline testing |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Candidate sanitizer for generated answer HTML |
| [electron-builder](https://www.electron.build/) | Desktop application packaging tooling |

## Implementation-time checks

- Record exact upstream commit, model digests, runtime versions, and download provenance.
- Read applicable runtime, weights, voice, icon, and asset licenses before bundling.
- Verify local-only mode through network observation and disconnected operation.
- Check current distribution and payment terms before selecting a public release or sales platform.
- Measure on actual target hardware; model download size alone does not establish required RAM or speed.
