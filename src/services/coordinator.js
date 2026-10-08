const { randomUUID } = require('node:crypto');
const { buildMessages } = require('./prompts');

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
  }

  async ask({ question, mode, context, model }) {
    this.cancel();
    const currentKey = context.sourceId || context.id;
    if (this.sessionKey && (this.sessionKey !== currentKey || this.mode !== mode)) {
      this.history = [];
      this.hintLevel = 0;
    }
    this.sessionKey = currentKey;
    this.mode = mode;

    const job = { id: randomUUID(), controller: new AbortController() };
    this.active = job;
    this.emit({ type: 'started', requestId: job.id, capturedAt: context.capturedAt });

    try {
      const answer = await this.infer({
        model,
        image: context.image,
        signal: job.controller.signal,
        messages: buildMessages({ question, mode, context, history: this.history, hintLevel: this.hintLevel }),
        onDelta: delta => {
          if (this.active === job) this.emit({ type: 'delta', requestId: job.id, delta });
        }
      });
      if (this.active !== job) return;
      this.history = [...this.history, { role: 'user', content: question }, { role: 'assistant', content: answer }].slice(-this.maxHistory);
      this.hintLevel += 1;
      this.emit({ type: 'done', requestId: job.id, turn: Math.floor(this.history.length / 2) });
    } catch (error) {
      if (this.active === job) this.emit({ type: 'error', requestId: job.id, message: error.message });
    } finally {
      if (this.active === job) this.active = null;
    }
  }
}

module.exports = { Coordinator };
