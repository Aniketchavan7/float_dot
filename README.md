# Float Dot

**Ask your screen from a floating desktop icon.**

Windows Electron desktop app. It opens as an always-on-top dot; click to expand, choose a window/display, take or open a screenshot, and get an explanation. Supports spoken questions and follow-ups.

Choose **OpenAI, Anthropic, Gemini, another OpenAI-compatible API, or local Ollama**. You supply your provider/model and API key where required. No Float Dot website, account or hosted backend is needed.

## Run

```powershell
npm ci
npm start
```

Click the floating dot, then the settings icon. Choose a provider, enter its model ID and your API key, and click **Save AI settings**. For Other, supply an API base URL such as `https://your-provider.example/v1`; it must support Chat Completions streaming. HTTPS is required for remote endpoints; localhost HTTP is supported.

Enable **Send the screenshot image** when using a vision-capable model. Image mode skips OCR and can explain screenshots without installing Ollama or speech assets. Model IDs are user-controlled; support and account availability vary by provider.

For OCR text mode or voice input, install local assets:

```powershell
npm run setup:local
```

For local reasoning, install/start Ollama and download a model of your choice. Select Ollama and enter an installed model ID. The local list is not restricted to Qwen. Keep Ollama cloud features disabled for the local path. API providers may charge for requests; Ollama does not require a paid inference API.

## Use the desktop app

- Click the dot to open the panel; use the collapse button to return to the dot. The tray menu also opens it.
- Pick a window or display and click **Read screen**. With no question entered, Float Dot asks for an explanation.
- Click **Ask with voice**, speak and click again to stop. The default shortcut is `Ctrl+Shift+Space`; change it in settings.
- Take a Windows snip, then click **Use clipboard screenshot**; or choose **Open screenshot** for a saved image. Imports are explicit, never automatically watched or uploaded.
- Review the preview, timestamp, question and destination. Click **Explain with…** to send to the chosen provider.
- Follow-ups reuse the capture. Asking to read the screen again recaptures the selected source. Read screen always takes a new snapshot.
- Stop cancels work. Clear removes in-memory context. Copy/export and installed local read-aloud are available.

API keys are encrypted with the OS and stored separately from settings under Electron userData. The renderer never receives stored keys. Custom keys are bound to their endpoint; remove a key through AI settings. Capture images stay in memory; the selected provider receives extracted text or the image according to the saved mode. There is no automatic provider fallback.

## Verification

```powershell
npm test
npm run smoke
npm run pack
```

32 automated tests and the desktop smoke pass, including synthetic screenshot -> loopback mock API -> answer, and OS key encryption. Cloud requests were tested with protocol fixtures, not real paid accounts. The native screenshot picker/clipboard, multi-display capture, live microphone, offline local flow and packaged external-run still need hands-on validation.

`npm run test:eval` runs the existing 30-case **local Ollama corrected-text** benchmark. `-- --sample` selects three cases; `-- --sample --reasoning` tests the optional slower Qwen compatibility mode. These commands do not evaluate the configured cloud provider. Live local model results remain below the original performance gate.

`npm run pack` creates `dist/win-unpacked/Float Dot.exe`; `npm run build:win` targets a portable executable. Packaging alone is not a release certification.

## Project documents

- [PRD.md](PRD.md): current desktop/provider requirements.
- [PLAN.md](PLAN.md): delivery order.
- [BUILD_STATUS.md](BUILD_STATUS.md): actual checks and limitations.
- [BACKLOG.md](BACKLOG.md): remaining work.
- [PROVENANCE.md](PROVENANCE.md): source/dependency provenance.
- [SOURCES.md](SOURCES.md): reference links.

Basic local use remains available. Revenue experiments focus on setup help and tailored workflows after repeat-use validation.
