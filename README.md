# Float Dot

> **A transparent, hovering AI desktop copilot for your screen and voice.**  
> Get instant, progressive DSA hints, debug stubbornly cryptic errors, explain code, and capture meeting notes directly over your desktop without breaking focus.

Float Dot is an always-on-top, frameless desktop application built with Electron, inspired by sleek hovering glass overlays like [OpenCluely](https://github.com/TechyCSR/OpenCluely). It floats unobtrusively over your IDE, browser, LeetCode, or terminal, captures only when you explicitly ask, and streams responses from either your own **local, 100% offline Ollama instance** or your preferred **cloud AI provider** (OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint).

---

## ✨ Features

- **🪟 OpenCluely-Style Translucent Hovering Tab**: Frameless acrylic glassmorphism (`backdrop-filter: blur(28px)`), smooth rounded corners, and a draggable top header. Collapses instantly into a minimal floating dot when you want zero screen clutter.
- **⚡ Zero-Friction Screen Capture**: Automatically defaults to your entire screen without forcing you to parse confusing internal OS processes (like `npm start` or `NVIDIA GeForce Overlay`). Captures on demand only—no continuous background recording, no idle polling, no hidden uploads.
- **🎙️ Voice with Real-Time Feedback**:
  - **Idle**: Clean `Ask with voice` action.
  - **Recording**: Pulsing red button state with a live stopwatch (`Stop recording (00:04)`), soundwave animations, and a glowing outer border.
  - **Transcribing**: Spinning loader (`Transcribing audio...`) with instant status transitions.
  - **Streaming**: Live markdown streaming with syntax highlighting and quick-action buttons (`Copy`, `Export note`, `Read aloud`, `Follow-up`).
- **💡 4 Tailored Assistant Modes**:
  - **DSA hints**: Progressive hints that guide your intuition without spoiling the full solution.
  - **Debug**: Pinpoints root causes in error logs and stack traces, giving immediate next steps.
  - **Explain**: Translates complex algorithms, codebases, or architectures into plain English.
  - **Meeting**: Live transcription, timestamped speech timeline, decisions vs. proposals tracking, and Markdown note export.
- **🔒 Privacy-First & OS-Level Key Security**: API keys are encrypted at rest using Windows DPAPI (`safeStorage`) and never exposed to the frontend or git. Capture data stays entirely in memory.
- **⚡ Blazing Fast Local Inference**: Tuned for `qwen3:1.7b` via Ollama with 100% pass rates on our 30-case benchmark and a **663ms median time-to-first-byte (TTFB)**.

---

## 🚀 Installation & Quickstart Guide

### 1. Prerequisites
- **Node.js**: Version 18.x or 20.x LTS installed ([nodejs.org](https://nodejs.org/)).
- **Git**: Installed and available in your terminal ([git-scm.com](https://git-scm.com/)).
- **OS**: Windows 10 or 11 (64-bit).

---

### 2. Clone and Install Dependencies

```powershell
# Clone the repository
git clone https://github.com/Aniketchavan7/float_dot.git
cd float_dot

# Install project dependencies
npm install
```

---

### 3. Choose Your AI Setup

Float Dot supports two flexible setups:

#### Option A: 100% Local & Offline (Free, No API Keys)

1. **Install and start Ollama**:
   Download Ollama from [ollama.com](https://ollama.com) and start the service.

2. **Pull the recommended fast model**:
   ```powershell
   ollama pull qwen3:1.7b
   ```
   *(Optional alternatives: `llama3.2:3b`, `phi3:3.8b`, or `qwen3:4b`)*.

3. **Install local OCR & speech recognition assets**:
   Downloads the local Whisper CLI and Tesseract OCR model files:
   ```powershell
   npm run setup:local
   ```

4. **Verify local setup**:
   ```powershell
   npm run check:local
   ```

---

#### Option B: Cloud AI Providers (OpenAI, Gemini, Anthropic, Custom APIs)

1. No local model downloads or heavy speech files required if vision mode is enabled.
2. Launch Float Dot and open the **AI settings** (gear icon `⚙` in the header).
3. Select your provider (**OpenAI**, **Anthropic**, **Gemini**, or **Other OpenAI-compatible API**).
4. Enter your model ID (e.g. `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-flash`) and paste your API key.
5. Check **Send screenshot image directly** to use your model's native vision capabilities.
6. Click **Save AI settings**. Keys are encrypted with Windows DPAPI and stored securely.

---

### 4. Running the App

You can launch Float Dot in two ways:

- **1-Click Launch (Desktop Batch Script)**:
  Double-click `run.bat` located in the project root.
- **Terminal Launch**:
  ```powershell
  npm start
  ```

---

## 🎯 Usage & Shortcuts

| Action | Control / Shortcut | Description |
|---|---|---|
| **Voice Question** | `Ctrl + Shift + Space` *(or click Ask with voice)* | Starts microphone recording. Click again or re-press shortcut to stop and transcribe. |
| **Instant Screen Read** | Click `⚡ Read screen` | Takes a fresh screenshot of the active screen and explains it according to your mode. |
| **Collapse / Expand** | Click `−` in header *(or click floating dot)* | Toggles between the hovering transparent tab and the compact desktop dot. |
| **Follow-up Questions** | Keep `Keep current screen for follow-ups` checked | Continue asking follow-up questions about the same screenshot without recapturing. |
| **Recapture** | Click `⚡ Read screen` or say *"look at the screen"* | Refreshes the screenshot with current screen contents. |
| **Clipboard / Image** | Click `📋 Paste` or `📁 File` | Explain an image from your clipboard or open a saved PNG/JPEG file. |
| **Close App** | Click `✕` in header | Completely exits Float Dot and unregisters global shortcuts. |

---

## 🧪 Testing & Verification

Float Dot comes with a rigorous automated test and benchmark suite:

```powershell
# 1. Run all 37 core unit tests (IPC, settings, streams, audio worklet, coordinator)
npm test

# 2. Run the headless Electron smoke test (Capture + OCR + loopback SSE provider handoff)
npm run smoke

# 3. Run the 30-case evaluation benchmark against live Ollama
npm run test:eval

# 4. Verify local microphone and Whisper speech engine
npm run test:audio
```

### Benchmark Results (`qwen3:1.7b`)
- **Evaluation Corpus**: 30 standard technical cases (10 DSA, 10 Debugging, 10 Code Explanations).
- **Correctness Rate**: **30 / 30 (100%) Passed**
- **Median Time-To-First-Byte (TTFB)**: **663 ms** (Target: $\le$15s)
- **Median Total Response Duration**: **2.13 s**

---

## 📦 Packaging & Distribution

To create standalone Windows binaries:

```powershell
# Build unpacked directory in dist/win-unpacked/Float Dot.exe
npm run pack

# Build standalone portable executable in dist/
npm run build:win
```

---

## 🔮 What Can Be Upgraded Next (Architecture & Feature Roadmap)

Here are the highest-impact architectural and feature upgrades recommended for future versions:

### 1. 🕵️ Stealth / Screen-Share Exclusion (`SetWindowDisplayAffinity`)
- **What it is**: Making the floating window completely invisible during screen shares (Zoom, Google Meet, Microsoft Teams, Discord, OBS).
- **How to implement**: Leverage Windows API `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` via a native Node addon or Electron's native window handles. This ensures you can view hints and explanations during technical assessments without the overlay being captured in screen recordings or shared screens.

### 2. 🖱️ Global Click-Through / Passthrough Mode
- **What it is**: Allowing mouse clicks to pass directly through the transparent overlay to your IDE, browser, or terminal beneath.
- **How to implement**: Add a toggle hotkey (e.g. `Ctrl + Alt + T`) that sets `panel.setIgnoreMouseEvents(true, { forward: true })`. When mouse clicks are passed through, you can code and test in your editor while reading AI hints displayed in the floating glass card.

### 3. ✂️ Interactive Region Snipping Tool (Crosshair Overlay)
- **What it is**: Instead of capturing the entire screen or manually entering pixel coordinates in the crop drawer, provide an interactive crosshair tool (like Windows Snip & Sketch).
- **How to implement**: Create a full-screen transparent canvas overlay on `Ctrl + Shift + S` where users can drag to select the exact bounding box of code, an error message, or a diagram.

### 4. 🗣️ Continuous Audio Stream & Push-to-Talk (PTT)
- **What it is**: Hold-to-talk keybinding (e.g. hold `Caps Lock` or a mouse thumb button) with real-time streaming speech-to-text.
- **How to implement**: Stream audio buffers chunk-by-chunk through the Audio Worklet directly into Whisper streaming or Gemini Multimodal Live API, displaying live speech text as you speak.

### 5. 👥 Multi-Speaker Diarization in Meeting Mode
- **What it is**: Automatically identifying and labeling different speakers (e.g. *Interviewer*, *Candidate*, *Speaker 1*, *Speaker 2*) in the live meeting transcript.
- **How to implement**: Incorporate PyAnnote or a lightweight acoustic voice-embedding model to cluster speech turns by vocal profile before generating meeting summaries.

### 6. 🏃 Embedded Local Code Runner / Sandbox
- **What it is**: Run and verify code snippets generated in the answer card directly inside Float Dot with one click.
- **How to implement**: Add a `Run Code` button on code blocks that securely executes Python / Node.js in an isolated worker or container, printing standard output and test results directly below the explanation.

---

## 📄 License & Privacy Notice

Float Dot is open-source under the Apache License 2.0.  
**Privacy Assurance**: Float Dot captures screen and microphone data only when you explicitly press a button or shortcut. No data is ever collected, telemetry is zero, and your API keys never leave your machine.
