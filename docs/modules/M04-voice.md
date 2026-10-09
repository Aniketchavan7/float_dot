# M04 — Voice input

**Suggested owner:** either · **Estimate:** 3–5 days · **Dependencies:** M00

Outcome: speaking is a dependable alternative to typing.

**9 October implementation:** built and automated checks passed; real microphone/accent gate remains open. See [verification](../M04_VERIFICATION.md) and [remaining timeline](../DELIVERY_TIMELINE.md).

Entry: `src/renderer/audio.js`, `audio-worklet.js`, `src/services/transcription.js`, microphone IPC. Proposed renderer boundary: `voice-controller.js`.

- [x] Preserve click and toggle-shortcut recording; make opening, recording, transcribing and cancellation states explicit. Stop remains available during transcription.
- [x] Handle permission denial, unavailable/disconnected microphone, low audio energy and 30-second limits; retain quiet signals above the threshold. Real quiet-speech accuracy still needs testing.
- [x] Release tracks/AudioContext on stop/cancel/error and renderer teardown; isolate pending initialization attempts and ignore obsolete transcription results. Physical crash recovery remains a release check.
- [x] Offer editable questions in capture review, including reused-screen voice follow-ups. Explicit recapture commands are distinguished from explanatory/negated questions.
- [x] Keep local speech optional and point missing-runtime users to Voice setup in AI Settings. No automatic download; graphical install flow belongs to M07/M09.
- [ ] Test technical vocabulary, numbers/operators and at least two accents on actual microphones.

**Complete when:** 20 real recordings pass start/stop/cancel/retry without leaving the microphone active; corrected transcripts are exactly what the provider receives; silent input does not trigger an invented question. Record end-of-speech, transcription and first-answer timings separately.

**Handoff:** consented or synthetic audio fixtures, microphone/permission checklist and timing report. Continuous listening, speaker diarization and global key-up hooks for true hold-to-talk are deferred.
