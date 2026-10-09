const { randomUUID } = require('node:crypto');
const { buildMessages, answerPolicy } = require('./prompts');
const { normalizeAnswer, assessAnswer } = require('./answer-quality');

class Coordinator {
  constructor({ infer, emit, maxHistory = 4 }) {
    this.infer = infer;
    this.emit = emit;
    this.maxHistory = maxHistory;
    this.active = null;
    this.history = [];
    this.mode = null;
    this.sessionKey = null;
    this.hintLevel = 0;
    this.turnCount = 0;
  }

  cancel() {
    if (!this.active) return;
    const previous = this.active;
    this.active = null;
    previous.controller.abort();
    this.emit({ type: 'canceled', requestId: previous.id });
  }

  clear() {
    this.cancel();
    this.history = [];
    this.sessionKey = null;
    this.mode = null;
    this.hintLevel = 0;
    this.turnCount = 0;
  }

  async ask({ question, mode, context, model, snapshot }) {
    this.cancel();
    const currentKey = context.sourceId || context.id;
    if (this.sessionKey && (this.sessionKey !== currentKey || this.mode !== mode)) {
      this.history = [];
      this.hintLevel = 0;
      this.turnCount = 0;
    }
    this.sessionKey = currentKey;
    this.mode = mode;

    const job = { id: randomUUID(), controller: new AbortController() };
    this.active = job;
    this.emit({ type: 'started', requestId: job.id, capturedAt: context.capturedAt });

    try {
      const hintOnly = answerPolicy(mode, question, this.hintLevel).hintOnly;
      const rawAnswer = await this.infer({
        model: snapshot?.model || model,
        snapshot,
        image: context.image,
        signal: job.controller.signal,
        messages: buildMessages({ question, mode, context, history: this.history, hintLevel: this.hintLevel }),
        onDelta: delta => {
          if (this.active === job && !hintOnly) this.emit({ type: 'delta', requestId: job.id, delta });
        }
      });
      if (this.active !== job) return;
      const answer = normalizeAnswer(rawAnswer);
      const quality = assessAnswer({ answer, mode, question, hintLevel: this.hintLevel });
      if (quality.hintViolation) throw new Error('The model returned too much for one hint. Ask for a smaller nudge or choose another model.');
      if (hintOnly) this.emit({ type: 'delta', requestId: job.id, delta: answer });
      this.history = [...this.history, { role: 'user', content: question }, { role: 'assistant', content: answer }].slice(-this.maxHistory);
      this.hintLevel += 1;
      this.turnCount++;
      this.emit({ type: 'done', requestId: job.id, turn: this.turnCount, answer, warnings: quality.issues });
    } catch (error) {
      if (this.active === job) this.emit({ type: 'error', requestId: job.id, message: error.message });
    } finally {
      if (this.active === job) this.active = null;
    }
  }
}

module.exports = { Coordinator };
