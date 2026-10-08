# Implementation provenance

Float Dot 0.1 is newly written JavaScript/HTML/CSS. OpenCluely is the implementation reference requested by the project owner, pinned at `0a9da75135f5aade3a067d86a7c8bb73f372f014`. Service separation, floating-window behavior, and the screen/voice workflow informed this prototype. No OpenCluely source files, images, icons, branding, prompt files, or setup scripts have been copied into the application.

See [REFERENCE_AND_TIMELINE.md](REFERENCE_AND_TIMELINE.md) for the reference map. The upstream checkout remains ignored and local. Source triage found a Gemini requirement, screen-only screenshot service, Python Whisper worker, and a certificate override; this implementation uses its own local adapter, selected-window capture, whisper.cpp invocation, and default certificate validation.

## Downloaded assets and dependencies

- Speech runtime: official ggml-org/whisper.cpp `b5454`, Windows CPU x64 archive, verified against the release-published SHA-256. Its license is downloaded beside the runtime.
- Speech weights: `ggerganov/whisper.cpp` base model. Setup records URL and file SHA-256 in the ignored `.models/downloads.json`. The current weight URL is mutable and not independently authenticated by a pre-pinned digest; pin model revisions/digests before public release.
- OCR: Tesseract.js 7 WebAssembly worker, with locally downloaded English tessdata_fast. Data license is downloaded beside the model. Its current data URL is mutable; setup records the resulting hash.
- AI: user-installed Ollama, configured locally with cloud disabled for development; Qwen3 4B weights managed by Ollama. No API key is embedded.
- UI: locally installed marked, DOMPurify, and PrismJS; no remote script/font CDN.
- Desktop: Electron version and package integrity recorded in package-lock.json. Runtime archive must match the official Electron checksum, including when a mirror supplies the bytes.

Dependencies keep their own upstream licenses in installed packages. No release should remove required notices. Before public redistribution, finish the asset/model/dependency notice inventory and make downloads reproducible by revision/digest. The prototype is not claimed to have completed the PRD's full distribution audit.
