# Float Dot — 5-User Pilot Testing Guide & Protocol (M10)

## Welcome Testers!

Thank you for participating in the Float Dot v1 private pilot. Float Dot is a lightweight, transparent desktop assistant for Windows 11 designed to stay out of your way while you work, code, or study.

---

## 1. What You Need Before Starting

- **Operating System:** Windows 11 x64.
- **Inference Choice (Pick One):**
  - **Option A — Local AI (Ollama):** 100% private, runs on your PC. Install [Ollama](https://ollama.com) and run `ollama pull qwen3:1.7b` (or any model you prefer).
  - **Option B — Cloud AI (Bring Your Own Key):** Bring an API key for OpenAI, Anthropic, Gemini, or an OpenAI-compatible endpoint.

---

## 2. Step-by-Step Pilot Journey (Day 1)

### Step 1: Launch Float Dot
Run `Float Dot.exe`. You will see a sleek, transparent floating pill near the top of your screen:
- Notice the draggable brand dot on the left. You can drag it to any comfortable location on your screen.
- If it's your first run, the **Welcome to Float Dot** onboarding wizard will appear automatically.

### Step 2: Configure Your Provider
- In the Onboarding Wizard, select either:
  - **Local AI (Ollama)**: If you want zero internet inference.
  - **Cloud AI (BYOK)**: If you want to use GPT-4o, Claude 3.5 Sonnet, or Gemini. Enter your key in AI Settings and click **Save AI settings**.
- Click **Test connection** in AI Settings to verify your connection with a minimal 1-token test and view your live latency and capability badges.

### Step 3: Read Your First Screen
1. Open any code file, terminal error, or documentation page in another application.
2. Click the **Read** button on the Float Dot toolbar (or press `Alt + Shift + S`).
3. An attached glass answer card will appear, providing a structured, concise response with:
   - `### Answer`
   - `### Screen evidence`
   - `### Next step`

### Step 4: Ask a Voice Follow-up
1. Click the **Voice** button (or press `Ctrl + Shift + Space`).
2. Speak your follow-up question (e.g., *"How can I optimize this loop?"*).
3. Click Stop (or stop speaking). Review your question in the follow-up bar and send it.
4. Notice the **Session Memory** badge—Float Dot remembers your previous context so you can have a natural multi-turn conversation.

### Step 5: Collapse and Minimize
- Press `Escape` or click `− Collapse to dot` in the menu (`⋯`). Float Dot shrinks to a minimal 46px floating dot.
- Click the center of the dot to expand it back to full toolbar.
- Right-click the system tray icon to show/hide at any time.

---

## 3. Privacy & Safety Guarantee

- **Your Data Remains Yours:** Float Dot has no cloud account, no telemetry, and no centralized backend.
- **Local Mode:** Screen captures and audio recordings never leave your machine.
- **Cloud Mode:** Sent directly to your chosen provider via encrypted HTTPS using your own API key.
- **Encrypted Storage:** API keys are encrypted at rest using Windows DPAPI (`safeStorage`).
- **Sanitized Diagnostics:** If you encounter an issue, clicking **Export Sanitized Diagnostics** produces a diagnostic JSON file that strictly redacts all keys, screen text, audio, and prompt history.

---

## 4. Daily Pilot Log & Feedback Form

Please keep quick notes across the 7 days of the pilot using this template:

| Day | Task | Result / Observations | Rating (1-5) |
| --- | --- | --- | --- |
| Day 1 | Setup & First Answer | Configured provider in under 5 minutes; first answer was clear and structured. | ⭐⭐⭐⭐⭐ |
| Day 2 | Debugging a Real Error | Used Read Screen on terminal stack trace in Debug mode (`🐞`). | |
| Day 3 | Voice Input & Follow-up | Spoke question; tested session memory across multiple turns. | |
| Day 4 | Multi-Monitor / Placement | Moved overlay across monitors; tested collapse & restore. | |
| Day 5 | DSA / Coding Practice | Tested Hint mode (`💡`) without spoiling solution. | |
| Day 6 | Normal Daily Coding | Kept Float Dot pinned on top while working in IDE. | |
| Day 7 | Final Review & Feedback | Overall experience, speed, and desired improvements. | |

### Feedback Questions for Day 7:
1. Did the app ever steal focus while you were typing in your code editor or browser? (Yes / No)
2. Were answers sufficiently concise and to the point, or did you observe unwanted conversational filler?
3. Did voice transcription accurately capture your programming terminology?
4. What is the single most important improvement you would like to see in v1.1?

---

## 5. Reporting Defects

If you encounter an error:
1. Open `⚙ AI Settings` -> click **Export Sanitized Diagnostics**.
2. Note the error message shown in the inline banner.
3. Submit your diagnostic file and observation to the developer team.
