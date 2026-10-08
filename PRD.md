# Float Dot — Product Requirements Document

Version 2.0 · 8 October 2026 · Windows desktop application

This revision follows the owner's clarified scope: a floating desktop icon that reads a requested screenshot/window/display and explains it using the user's chosen AI provider. It supersedes the local-only requirements in [the archived v1 PRD](docs/PRD_LOCAL_V1.md). Implementation evidence is in [BUILD_STATUS.md](BUILD_STATUS.md).

## Product and core experience

Float Dot lives as a draggable, always-on-top desktop dot. Clicking it opens a compact answer/settings panel; collapsing returns to the dot. It is an installed Electron desktop app with tray access. No browser tab, website, hosted dashboard or Float Dot account is required.

1. Choose Ollama, OpenAI, Anthropic, Gemini or another OpenAI-compatible API.
2. Select or enter the model ID. For an API, enter the user's own key; custom APIs also need a base URL.
3. Choose a window/display and click **Read screen**, or ask through the microphone. Alternatively, open an existing screenshot or deliberately use a clipboard screenshot after taking a Windows snip.
4. Show the capture preview, source, timestamp and destination provider. Allow question correction and optional review before inference.
5. Send extracted screen text, or the screenshot when the user enables image mode with a vision-capable model.
6. Stream the explanation into the floating panel. Support Stop, Copy, export and optional local read-aloud.
7. Follow-ups reuse the identified capture. Asking to read/capture the screen again takes a fresh capture. Changing source clears prior source context.

There is no continuous screen recording, idle screenshot polling, clipboard watching or automatic upload of Windows screenshots. Screen and clipboard access happens through the user's explicit capture/import action. Source enumeration returns names/IDs without requesting thumbnail images.

## Provider choice and cost

| Provider | Connection | Model selection | Content destination |
| --- | --- | --- | --- |
| Ollama | Loopback Ollama API | Any installed local model family | This computer |
| OpenAI | Responses API | User-supplied supported model ID | OpenAI |
| Anthropic | Messages API | User-supplied supported model ID | Anthropic |
| Gemini | Generate Content streaming API | User-supplied supported model ID | Google |
| Other compatible API | User-configured Chat Completions base URL | User-supplied model ID | Configured endpoint |

No provider is mandatory. Ollama remains the path without paid inference APIs; adequate hardware and downloaded assets are still required. Cloud API costs and quotas belong to the user's provider account. Float Dot does not promise that external APIs are free. A custom endpoint must implement the supported protocol; arbitrary vendor APIs are not automatically compatible.

Provider choice is explicit and persists locally. There is no automatic fallback to another provider. Image mode requires a model that actually supports image input; OCR text mode works with text models. Remote-backed Ollama tags are excluded from the local choice so that local means local. Users can choose a cloud connection explicitly through the API adapters.

## Audience and use cases

- Explain visible code, stack traces, documentation, a settings screen or a screenshot.
- Ask one DSA hint or review an attempt; full solution only when requested.
- Describe visual UI/diagrams when an image-capable model is selected.
- Ask a spoken question without manually copying text into a separate chat app.
- Microphone meeting notes are an existing experiment. Improving the main screenshot/explanation flow takes priority over expanding meetings.

## Functional requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| FD2-01 | Desktop dot | Launch into the dot, drag it, open/collapse the panel, recover from tray and monitor removal. |
| FD2-02 | Provider selection | All five adapter choices available; editable model ID; no Qwen-only restriction. |
| FD2-03 | API keys | Save/remove with OS-backed encryption; never return keys in settings/status, log them, or store plaintext in the repository. |
| FD2-04 | Explicit capture | Choose window/display, take a snapshot only on request; no silent switch to another source. |
| FD2-05 | Existing screenshots | Native file picker and deliberate clipboard-image import; no directory/clipboard monitoring. |
| FD2-06 | Text and image modes | OCR text mode and opt-in image mode; preview before sending; destination remains visible. |
| FD2-07 | Voice | Click or configured shortcut to start/stop, 30-second limit, local transcription, correction, visible recording and microphone release. |
| FD2-08 | No typing required | Read screen with an empty question uses an explanation request. Voice follow-ups can request a fresh screen capture. |
| FD2-09 | Streaming | Correct parsing across split network chunks, bounded output, provider-specific termination, safe Markdown, actionable failures. |
| FD2-10 | Cancel/context | Cancel ASR/OCR/inference; ignore stale results; bounded history; changing providers cancels in-flight inference and clears conversational history. |
| FD2-11 | Evidence | Show capture name/time and provider/model; do not imply access to hidden tabs, files or uncaptured content. |
| FD2-12 | User controls | Theme, microphone, shortcut conflict handling, capture review, Clear, Copy, explicit export and optional installed-voice read-aloud. |
| FD2-13 | Setup | Cloud image mode can be used without Ollama/OCR; local OCR and microphone assets are optional according to the chosen flow. |
| FD2-14 | Recovery | Missing key/model, denied microphone, unavailable window, unreadable image, rate limit, server failure and incomplete stream return actionable errors. |

## Technical stack

Electron main/preload/sandboxed renderer; HTML/CSS/vanilla JavaScript inside native desktop windows; Node services and native fetch; electron-builder for Windows distribution. No hosted backend is required.

- Capture: Electron desktopCapturer and nativeImage, native screenshot file dialog, explicit clipboard.readImage.
- Audio: AudioWorklet, mono PCM16 WAV at 16 kHz, whisper.cpp for local speech.
- OCR: local Tesseract.js/WASM with English trained data.
- AI: shared provider interface; Ollama NDJSON and provider-specific SSE adapters; screenshot encoding adapted per protocol.
- Secrets: Electron safeStorage in the main process and an encrypted credentials file under app userData. A custom API key is bound to its exact normalized base URL.
- Settings: versioned JSON with runtime validation and atomic writes. Keys are separate from settings.
- Rendering: marked + DOMPurify + PrismJS under restrictive CSP.
- Tests: Node regression/adapter tests and Electron synthetic end-to-end smoke; live cloud-provider tests require the user's configured account.

## Data flow and retention

Explicit capture/import -> in-memory image -> either local OCR or image mode -> user review -> selected provider -> streamed explanation.

Speech -> local Whisper -> editable question -> same request flow.

The main process owns full capture images, API credentials and network requests. The renderer receives a preview and public metadata. Network redirects are refused so credentials are not forwarded to a different server. API error bodies are not echoed into the UI. The renderer cannot navigate or fetch arbitrary remote pages.

Sessions and captures stay in memory unless the user deliberately exports notes. Stop retains a meeting transcript; Clear deletes it. API provider retention policies apply to requests sent to that provider. The OpenAI adapter disables response storage through the request option; this does not constitute a blanket provider-retention guarantee.

Bounds: question up to 2,000 characters, OCR excerpt up to 12,000, at most four history messages, output up to 24,000 characters, screenshot input up to 20 MB, 120-second inference timeout. No automated actions, code execution or message sending by the assistant.

## UI behavior

The dot is the default entry point. The panel contains a source selector, voice/Read screen actions, screenshot import, capture review and answer. AI settings include provider, model ID, key, optional custom endpoint, image mode and destination description. Provider/model identity appears with the answer. Theme supports light, dark and system; keyboard focus and reduced motion remain required.

Settings changes do not call a paid API. Saving a key does not perform live inference. Selecting a cloud provider explains which content will be sent and that provider usage may cost money. A provider error never silently routes data to a different service.

## Verification and release gates

- Unit/contract tests for all adapters, complete/incomplete/error streams, UTF-8 chunk splits, cancellation, input validation, encrypted key storage and endpoint isolation.
- Desktop synthetic smoke: AudioWorklet, real native window capture/OCR, screenshot handoff through a loopback mock API, final answer event, OS encryption roundtrip.
- Manual desktop checks: dot drag/collapse/tray, real screenshots/file/clipboard flow, display capture excluding the Float Dot overlay, mixed-DPI displays and keyboard navigation.
- Live tests per configured cloud provider; models, quotas and account access must be verified independently. Mock tests do not establish live provider compatibility.
- Run 30 screen/question cases and inspect final answers; at least 24 useful grounded answers, all ten first-hint DSA cases withhold the complete solution. Report latency by provider/model/input mode.
- Target warm median <=15 seconds to first useful final-answer text on a documented setup; publish p95 and cold results. A slow local model must not block the user's choice of a cloud provider.
- Ten real consecutive requests without source crossover, stuck recording or orphaned workers.
- Offline validation applies to the downloaded local Ollama/OCR/Whisper path. Cloud providers require connectivity.
- A packaged Windows application must be tested outside the development checkout before a tester release.

## Monetization and rollout

First validate the desktop screenshot-to-explanation experience with five users. Keep provider choice and basic local functionality available. Later revenue experiments can sell installation help, specialized developer workflows or team customization; purchases and repeat usage must be measured before adding billing infrastructure. No revenue is guaranteed.

Priority: provider flexibility and desktop capture -> live provider/hardware verification -> easier setup/package -> small pilot. Meetings, searchable history, browser extension, team billing and broader autonomous-agent actions remain separate scope.
