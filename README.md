# Float Dot

> **A transparent, hovering AI desktop copilot for your screen and voice.**  
> Get instant, progressive DSA hints, debug cryptic errors, explain code, and capture meeting notes directly over your desktop without breaking focus.

Float Dot is an always-on-top, frameless desktop application built with Electron, inspired by sleek hovering glass overlays like [OpenCluely](https://github.com/TechyCSR/OpenCluely). It floats unobtrusively over your IDE, browser, LeetCode, or terminal, captures only when you explicitly ask, and streams responses from either your own **local, 100% offline Ollama instance** or your preferred **cloud AI provider** (OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint).

---

## ✨ Features

- **🪟 Sleek Floating Capsule & Acrylic Glass Overlay**: Minimal 46px toolbar capsule (`backdrop-filter: blur(28px)`), smooth rounded corners, and a draggable brand dot. Collapses instantly into a minimal floating dot when you want zero screen clutter.
- **⚡ Zero-Friction Screen Capture**: Automatically defaults to your entire screen without forcing you to parse confusing internal OS processes. Captures on demand only—no continuous background recording, no idle polling, no hidden uploads.
- **🎙️ Voice with Real-Time Feedback & Review**:
  - **Idle**: Clean `Voice` button or `Ctrl + Shift + Space` shortcut.
  - **Recording**: Pulsing indicator with live audio soundwave animation and instant stop.
  - **Review & Transcribe**: Fast local Whisper speech recognition with editable transcript review before sending.
  - **Streaming**: Live markdown streaming with syntax highlighting and quick-action buttons (`Copy`, `Export note`, `Read aloud`, `Follow-up`).
- **💡 Tailored Assistant Modes & Crisp Structured Outputs**:
  - **Explain**: Direct answer, visible screen evidence, and concrete next steps.
  - **Hint (DSA)**: One concise nudge under 30 words that guides intuition without spoiling solutions.
  - **Debug**: Quotes exact visible error, hypothesizes root cause, and provides a non-destructive diagnostic check.
  - **Meeting**: Live transcription, timestamped speech timeline, decisions vs. proposals tracking, and Markdown note export.
- **🧠 Multi-Turn Session Memory**: Follow-up questions remember your current screen context without needing to recapture on every turn.
- **🔒 Privacy-First & OS-Level Key Security**: API keys are encrypted at rest using Windows DPAPI (`safeStorage`) and never exposed to the frontend or git. Screen data stays in memory.
- **🛡️ Anti-Prompt Injection Defense**: Captured screen text is enclosed in strict data isolation boundaries so untrusted text on your screen cannot hijack system instructions.
- **🔍 1-Token Connection Test & Capability Badges**: AI Settings includes an explicit connection test with roundtrip latency and capability badges (Vision, Reasoning, Local, Embedding warning).

---

## 🚀 Installation & Quickstart Guide

### 1. Prerequisites
- **Node.js**: Version 18.x, 20.x, or 22.x LTS installed ([nodejs.org](https://nodejs.org/)).
- **Git**: Installed and available in your terminal ([git-scm.com](https://git-scm.com/)).
- **OS**: Windows 11 x64 (or Windows 10 x64).

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

2. **Pull a model to get started**:
   ```powershell
   ollama pull qwen3:1.7b
   ```
   *(Optional alternatives: `llama3.2:3b`, `phi3:3.8b`, or `qwen3:4b`)*.

3. **Install local speech recognition assets (Optional for voice)**:
   ```powershell
   npm run setup:local
   ```

4. **Verify local setup**:
   ```powershell
   npm run check:local
   ```

---

#### Option B: Cloud AI Providers (OpenAI, Anthropic, Gemini, Custom APIs)

1. Cloud vision needs no local language model or OCR assets.
2. Launch Float Dot and open the First-Run Wizard or **AI settings** (`⚙` in menu `⋯`).
3. Select your provider (**OpenAI**, **Anthropic**, **Gemini**, or **Other OpenAI-compatible API**).
4. Enter your model ID (e.g. `gpt-4o-mini`, `claude-3-5-sonnet`, `gemini-1.5-flash`) and paste your API key.
5. Click **Test connection** to verify connectivity with a minimal 1-token test and view latency.
6. Click **Save AI settings**. Keys are encrypted with Windows DPAPI and stored securely.

---

### 4. Running the App

```powershell
# Start Float Dot
npm start
```

---

## 🎯 Usage & Keyboard Shortcuts

| Action | Shortcut / Control | Description |
|---|---|---|
| **Read Screen & Explain** | `Alt + Shift + S` or click `Read` | Captures active display/window and gives a structured explanation. |
| **Ask with Voice** | `Ctrl + Shift + Space` or click `Voice` | Starts microphone recording; click Stop or press shortcut again to transcribe. |
| **Collapse / Expand** | `Escape` or click `−` | Toggles between hovering capsule and compact floating dot. |
| **Follow-up Questions** | Type in follow-up bar + `Enter` | Asks follow-up questions retaining previous screen memory. |
| **Region Snip** | Click `✂ Region` in menu `⋯` | Drag a bounding box on your screen to capture a specific code snippet or error. |
| **Paste Image** | Click `📋 Paste` in menu `⋯` | Read and explain an image currently copied to your clipboard. |
| **Export Diagnostics** | In `⚙ AI Settings` -> click Export | Exports sanitized diagnostic JSON with zero keys, screen text, or audio. |

---

## 🧪 Testing & Verification

Float Dot includes a comprehensive automated test suite and leak verification:

```powershell
# 1. Run all 89 automated unit tests
npm test

# 2. Run M00 contract & fixture schema verification
npm run test:fixtures

# 3. Run M08 memory soak test (100 rapid request/cancel cycles)
npm run test:soak

# 4. Run the full desktop Electron smoke test
npm run smoke

# 5. Verify local microphone and Whisper speech engine
npm run test:audio
```

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

## 👥 Pilot Program

Float Dot is currently in private pilot testing. See [docs/PILOT_GUIDE.md](docs/PILOT_GUIDE.md) for the 5-user, 7-day testing protocol, task checklist, and feedback forms.

---

## 📄 License & Privacy Notice

Float Dot is open-source under the Apache License 2.0.  
**Privacy Assurance**: Float Dot captures screen and microphone data only when you explicitly press a button or shortcut. Telemetry is zero, and your API keys never leave your machine.
