# M04 voice handoff — 9 October 2026

Implementation and automated verification are complete for this pass. Human microphone/accent tests remain open; do not mark the physical release gate complete.

## Changes

- Each Recorder start owns its tracks, worklet and AudioContext. An old permission/worklet/resume result cannot cancel a newer recording. Stop, cancel, initialization failure and device disconnection release that attempt's resources.
- Specific recovery messages cover denied access, absent/unavailable devices and a busy microphone. A 30-second timer stops recording through the existing toggle flow.
- `voice-controller.js` owns stale transcription suppression and stage timing. Voice recognition now completes before deciding whether to reuse the current capture or obtain a fresh one.
- Capture review includes an editable question. Voice follow-ups respect the review preference. Confirm forwards the corrected question; editing a reused-screen question into an explicit recapture command obtains a fresh capture first.
- Transcribing remains cancellable. Optional speech setup is explained in AI Settings; typing and Read work without speech assets.
- Main validates PCM framing and rejects insufficient audio energy before launching Whisper. Question/meeting transcription share one bounded subprocess implementation; cancellation waits for process close before deleting its temporary WAV.
- Timestamp cleanup now preserves bracketed code indexes such as `nums[2]`. Non-speech markers are removed without stripping arbitrary bracketed technical content.

## Verification

`npm test`: **75/75 passed**. New tests cover late permission, overlapping worklet initialization, 20 synthetic record/stop/cancel cycles, disconnection, denial/unavailable device messages, quiet/silent PCM, the 30-second limit, stale transcription, stage timings, explicit recapture intent, timestamp/index cleanup and subprocess abort/temp-file cleanup.

`npm run test:fixtures`: passed. `npm run smoke`: passed, including previous capture/window checks and the new voice review check. The latter uses Electron's fake microphone and a synthetic recognition adapter, exercises the actual UI/preload/provider flow, and verifies the corrected expression arrives at the loopback provider. It does not certify recognition accuracy.

Separately, real local Whisper decoded two synthetic Windows TTS files (Microsoft Hazel Desktop and Microsoft Heera), each saying: “Explain why this array has ten elements. Give me one hint about binary search.” Both produced “Explain why this array has 10 elements. Give me one hint about binary search.”

| Synthetic fixture | Audio duration | Local transcription time |
| --- | --- | --- |
| `voice-question.wav` | 6.760 s | 2447 ms |
| `voice-question-india.wav` | 6.717 s | 1703 ms |

These are single samples on this machine, not latency guarantees or real-accent certification. The report lives at `.artifacts/voice-fixture-report.json`. Re-run: `node scripts/test-voice-fixture.cjs .artifacts/voice-question.wav .artifacts/voice-question-india.wav`. The runner accepts synthetic 16 kHz mono PCM fixtures and canonicalizes Windows TTS WAV headers before calling the normal speech service.

Voice timing tracks transcription, submission-to-first-displayed-answer, and end-of-speech-to-first-answer separately. Human review time is excluded from submission latency but included in total time. No transcript/audio is logged by the timing controller. The smoke's recognition/provider timings use mocks and are not performance measurements of Whisper or a real model.

## Physical checklist still open

- Twenty actual recordings across start, stop, cancel during permission/transcription, quick retry and disconnect; verify the Windows mic indicator switches off.
- Two consenting speakers with different accents: technical vocabulary, numbers/operators, quiet voice, background noise and silence. Energy checks do not prove speech presence or prevent every non-speech hallucination.
- Verify 30-second stop, configured device disappearance, permission denial/re-enable, shortcut toggling and renderer-crash cleanup on real hardware.
- Correct a transcript, confirm, and compare the exact provider-bound question; verify that a follow-up reuses evidence while an explicit recapture updates its timestamp.
- Record local transcription and real-provider first-answer timings separately. Keep paid/live provider tests explicit and within the selected configuration.

MeetingRecorder's longer-running recording lifecycle remains experimental and needs M08's soak/recovery checks; this pass focuses on short voice questions.
