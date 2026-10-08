# Float Dot — Engineering & Feature Delivery Plan

**Version 2.1 · October 2026**  
Authoritative delivery plan for Float Dot, incorporating the OpenCluely-style hovering glass architecture, structured output enforcement, and the 6 core future upgrades.

---

## 🎯 Core Product Vision

Float Dot is an always-on-top, frameless, transparent desktop AI copilot. It floats unobtrusively over coding platforms (LeetCode, HackerRank, Codeforces), IDEs (VS Code, JetBrains), and terminals, capturing screen content on demand and delivering **concise, refined, and structured answers** without breaking developer flow.

---

## 🧭 Foundational Principle: Structured, High-Signal Output

> **Priority Directive**: The AI must provide structured, refined, and to-the-point answers. Long unwanted lines, conversational filler ("Sure!", "Here is what I found..."), and verbose preambles are strictly eliminated.

### Output Standards by Mode:
1. **💡 DSA Hints**:
   - `**Core Pattern / Data Structure**`: 1 direct line (e.g. *Two-pointer on sorted array*).
   - `**Key Observation**`: 1-2 bullet points guiding intuition without revealing code.
   - `**Next Step**`: 1 guiding action sentence.
2. **🐞 Debug Mode**:
   - `**Observed**`: 1-sentence symptom summary.
   - `**Likely cause**`: Root cause analysis.
   - `**Next check**`: Immediate fix or verification command.
3. **✨ Explain Mode**:
   - High-density bullet points.
   - Minimal code examples only when essential.
   - Maximum 150-180 words.
4. **🎙️ Meeting Mode**:
   - Structured under `**Key Decisions**`, `**Action Items**` (with citations), and `**Open Questions**`.

---

## 🗺️ Roadmap & The 6 Core Upgrades

```
Phase 1 (Complete)       Phase 2 (Immediate)           Phase 3 (Expansion)
------------------       -------------------           -------------------
[x] OpenCluely Glass UI  [ ] 1. Stealth Screen-Share   [ ] 4. Push-to-Talk (PTT)
[x] Smart Screen Capture [ ] 2. Click-Through Mode     [ ] 5. Speaker Diarization
[x] Live Voice Feedback  [ ] 3. Crosshair Snip Tool    [ ] 6. Code Runner Sandbox
[x] Structured Prompts
```

---

### Upgrade 1: 🕵️ Stealth / Screen-Share Exclusion
- **Objective**: Ensure the Float Dot window is invisible to audience members during video conference screen shares (Zoom, Google Meet, Microsoft Teams, Discord, Slack, OBS).
- **Technical Path**:
  - Integrate Windows native API `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (value `0x00000011`).
  - Access `panel.getNativeWindowHandle()` in Electron main process.
  - Implement a toggle in AI Settings: `Hide window from screen sharing`.
- **Acceptance Criteria**:
  - Window remains 100% visible to the local user.
  - Window is completely invisible in captured display buffers, screen shares, and OS screenshot tools.

---

### Upgrade 2: 🖱️ Global Click-Through / Passthrough Mode
- **Objective**: Allow users to click and type into applications *behind* the floating card without moving or minimizing the tab.
- **Technical Path**:
  - Implement global toggle shortcut (e.g. `Ctrl + Alt + T`).
  - Call `panel.setIgnoreMouseEvents(true, { forward: true })`.
  - Dim the tab border or show a subtle "Passthrough" badge.
  - Pressing the shortcut again toggles `setIgnoreMouseEvents(false)`.
- **Acceptance Criteria**:
  - Mouse clicks pass through transparent card regions to VS Code/browser below.
  - Shortcut reliably restores interactivity.

---

### Upgrade 3: ✂️ Interactive Region Snipping Tool
- **Objective**: Allow users to drag a selection crosshair to capture an exact bounding box (code block, error log, diagram) rather than the whole screen.
- **Technical Path**:
  - Bind `Ctrl + Shift + S` or a `✂ Snip` button in the UI.
  - Launch a lightweight transparent full-screen overlay window across active displays.
  - Capture mouse drag `(startX, startY)` to `(endX, endY)`.
  - Pass the exact cropped bounding box to `capture(sourceId, crop)`.
- **Acceptance Criteria**:
  - Snip completes in $<300\text{ms}$.
  - Extracted text / image routes directly into current conversation context.

---

### Upgrade 4: 🗣️ Continuous Audio Stream & Push-to-Talk (PTT)
- **Objective**: Eliminate start/stop clicking by enabling push-to-talk (hold to speak) and streaming real-time transcription.
- **Technical Path**:
  - Register global key-down and key-up hooks (e.g. hold `Caps Lock` or mouse extra button).
  - Stream audio chunks continuously through Audio Worklet into Whisper / Gemini streaming session.
  - Real-time live transcript updates in the input textarea as the user speaks.
- **Acceptance Criteria**:
  - Recording starts on key-down and terminates immediately on key-up.
  - Median latency from key release to transcription $<400\text{ms}$.

---

### Upgrade 5: 👥 Multi-Speaker Diarization in Meeting Mode
- **Objective**: Differentiate between *Interviewer*, *Candidate*, and other participants in meeting transcripts.
- **Technical Path**:
  - Extract acoustic speaker embeddings for each speech segment.
  - Cluster voice vectors into distinct speaker IDs (`Speaker 1`, `Speaker 2`).
  - Allow user to rename speaker aliases in the live transcript drawer.
- **Acceptance Criteria**:
  - Speaker turns are clearly labeled with timestamps (`[02:15] Interviewer:`).
  - Generated summaries attribute decisions to specific speakers.

---

### Upgrade 6: 🏃 Embedded Code Runner / Sandbox
- **Objective**: Allow users to test and execute suggested code fixes or algorithms directly inside Float Dot with one click.
- **Technical Path**:
  - Add an interactive `▶ Run` button to all markdown code blocks.
  - Execute code inside an isolated Node.js `vm` or a lightweight local Python runner.
  - Display execution stdout, stderr, and runtime duration directly below the code block.
- **Acceptance Criteria**:
  - Standard algorithms (Python, JS) execute locally with execution timeout (5s).
  - Clean error capture for syntax and runtime errors.

---

## 📊 Verification & Release Quality Gates

| Verification Gate | Target Metric | Current Status |
|---|---|---|
| **Core Unit Tests** | 100% pass across all platforms | **37 / 37 Passed** (170ms) |
| **Electron Smoke Test** | Zero crashes, clean capture/audio handoff | **Passed** |
| **30-Case Benchmark** | $\ge 80\%$ quality rate | **30 / 30 (100%) Passed** |
| **Latency Benchmark** | Median TTFB $\le 15\text{s}$ | **663ms** |
| **Output Density** | Under 180 words, strictly structured | **Enforced in prompt engine** |

---

## 🚀 Execution Priority

1. **Sprint 1 (Now)**: Structured output enforcement, OpenCluely glass UI, smart screen default, and live voice recording states (Shipped).
2. **Sprint 2 (Next)**: Upgrade 1 (Stealth Screen-Share) & Upgrade 2 (Global Click-Through).
3. **Sprint 3**: Upgrade 3 (Crosshair Snip Tool) & Upgrade 4 (Push-to-Talk Voice).
4. **Sprint 4**: Upgrade 5 (Speaker Diarization) & Upgrade 6 (Code Runner Sandbox).
