const { randomUUID } = require('node:crypto');
const { validateAudio } = require('../shared/validation');

function formatTimestamp(seconds) {
  const totalSec = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

class MeetingService {
  constructor({ speech, infer, emit }) {
    this.speech = speech;
    this.infer = infer;
    this.emit = emit || (() => {});
    this.session = null;
    this.queue = Promise.resolve();
    this.summaryActive = null;
  }

  status() {
    if (!this.session) return { state: 'idle', segmentCount: 0 };
    return {
      id: this.session.id,
      state: this.session.state,
      startedAt: this.session.startedAt,
      segmentCount: this.session.segments.length,
      elapsedSec: Math.floor((Date.now() - this.session.startTimeMs) / 1000)
    };
  }

  start({ audioSource = 'microphone' } = {}) {
    this.clear();
    const sessionId = randomUUID();
    this.session = {
      id: sessionId,
      state: 'recording',
      audioSource,
      startedAt: new Date().toISOString(),
      startTimeMs: Date.now(),
      segments: [],
      controller: new AbortController()
    };
    return { id: sessionId, startedAt: this.session.startedAt, state: 'recording' };
  }

  pause() {
    if (this.session && this.session.state === 'recording') {
      this.session.state = 'paused';
      return true;
    }
    return false;
  }

  resume() {
    if (this.session && this.session.state === 'paused') {
      this.session.state = 'recording';
      return true;
    }
    return false;
  }

  stop() {
    if (!this.session) return null;
    this.session.state = 'stopped';
    return {
      id: this.session.id,
      startedAt: this.session.startedAt,
      stoppedAt: new Date().toISOString(),
      segments: [...this.session.segments]
    };
  }

  clear() {
    if (this.session) {
      this.session.controller.abort();
      this.session = null;
    }
    if (this.summaryActive) {
      this.summaryActive.controller.abort();
      this.summaryActive = null;
    }
  }

  async addAudioChunk(wavBuffer, offsetSec = 0) {
    if (!this.session || this.session.state !== 'recording') return null;
    const session = this.session;
    const validated = validateAudio(wavBuffer);

    const promise = this.queue.then(async () => {
      if (session !== this.session || session.controller.signal.aborted) return null;
      try {
        const text = await this.speech.transcribeSegment(validated, session.controller.signal);
        if (!text || !text.trim() || session !== this.session) return null;

        const timestamp = formatTimestamp(offsetSec);
        const segment = {
          id: randomUUID(),
          offsetSec,
          timestamp,
          text: text.trim()
        };
        session.segments.push(segment);
        this.emit('fd:meeting:segment', segment);
        return segment;
      } catch (err) {
        if (err.name !== 'AbortError' && session === this.session) {
          this.emit('fd:meeting:error', { message: err.message });
        }
        return null;
      }
    });

    this.queue = promise.catch(() => {});
    return promise;
  }

  getTranscriptText() {
    if (!this.session || !this.session.segments.length) return '';
    return this.session.segments
      .map(s => `[${s.timestamp}] ${s.text}`)
      .join('\n');
  }

  deleteSegment(segmentId) {
    if (!this.session) return false;
    const initial = this.session.segments.length;
    this.session.segments = this.session.segments.filter(s => s.id !== segmentId);
    return this.session.segments.length < initial;
  }

  async summarize({ model, customPrompt } = {}) {
    if (!this.session) throw new Error('No active meeting session.');
    const transcriptText = this.getTranscriptText();
    if (!transcriptText.trim()) throw new Error('Meeting transcript is empty. Record some meeting audio first.');

    if (this.summaryActive) {
      this.summaryActive.controller.abort();
      this.summaryActive = null;
    }

    const job = { id: randomUUID(), controller: new AbortController() };
    this.summaryActive = job;

    const systemPrompt = `You are Float Dot, an expert meeting analyst creating structured, verifiable meeting notes from a timestamped transcript.
Requirements:
1. Citations: Cite timestamp ranges (e.g. "[00:01:15]") for every key point.
2. Decisions vs Proposals: Clearly distinguish confirmed DECISIONS from PROPOSALS or suggestions under debate.
3. Action Items: Extract concrete action items with timestamp citations. NEVER invent owners, deadlines, or details not stated in the transcript (leave unknown fields as "Unassigned" or "TBD").
4. Open Questions: List unresolved questions, blockers, or topics tabled for later.
5. Format: Use clean Markdown with headers:
   ## Executive Summary
   ## Key Decisions
   ## Action Items
   ## Open Questions & Discussion
${customPrompt ? `\nUser focus: ${customPrompt}` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Here is the timestamped meeting transcript:\n\n<transcript>\n${transcriptText}\n</transcript>\n\nGenerate structured meeting notes with citations.` }
    ];

    this.emit('fd:meeting:summary-started', { requestId: job.id });

    try {
      const summary = await this.infer({
        model,
        messages,
        signal: job.controller.signal,
        onDelta: delta => {
          if (this.summaryActive === job) {
            this.emit('fd:meeting:summary-delta', { requestId: job.id, delta });
          }
        }
      });
      if (this.summaryActive === job) {
        this.emit('fd:meeting:summary-done', { requestId: job.id, summary });
      }
      return summary;
    } catch (err) {
      if (this.summaryActive === job) {
        this.emit('fd:meeting:summary-error', { requestId: job.id, message: err.message });
      }
      throw err;
    } finally {
      if (this.summaryActive === job) this.summaryActive = null;
    }
  }

  exportMarkdown(summaryText) {
    if (!this.session) throw new Error('No meeting session to export.');
    const started = new Date(this.session.startedAt).toLocaleString();
    const durationMins = Math.max(1, Math.round((Date.now() - this.session.startTimeMs) / 60000));
    const transcript = this.getTranscriptText();

    return `# Meeting Notes — ${started}

- **Date:** ${started}
- **Duration:** ~${durationMins} min
- **Audio Source:** ${this.session.audioSource}
- **Engine:** Float Dot (Local Whisper & Qwen3)

---

${summaryText || '*(No summary generated yet)*'}

---

## Full Timestamped Transcript

${transcript || '*(Empty transcript)*'}
`;
  }
}

module.exports = { MeetingService, formatTimestamp };
