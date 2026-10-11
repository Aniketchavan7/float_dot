const { assessCitations } = require('./citations');
const { validateSources } = require('../shared/contracts');
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
    const currentKey = context?.sourceId || context?.id || 'chat:default';
    if (this.sessionKey && (this.sessionKey !== currentKey || this.mode !== mode)) {
      this.history = [];
      this.hintLevel = 0;
      this.turnCount = 0;
    }
    this.sessionKey = currentKey;
    this.mode = mode;

    const job = { id: randomUUID(), controller: new AbortController() };
    this.active = job;
    this.emit({ type: 'started', requestId: job.id, ...(context ? {capturedAt:context.capturedAt} : {}) });

    try {
      const hintOnly = answerPolicy(mode, question, this.hintLevel, !!context).hintOnly;
      const rawAnswer = await this.infer({
        model: snapshot?.model || model,
        snapshot,
        question,
        onTool: message => { if (this.active === job) this.emit({ type: 'tool', requestId: job.id, message }); },
        onSources: sources => { if (this.active === job) job.sources = validateSources(sources); },
        image: context?.image,
        signal: job.controller.signal,
        messages: buildMessages({ question, mode, context, history: this.history, hintLevel: this.hintLevel }),
        onDelta: delta => {
          if (this.active === job && !hintOnly) this.emit({ type: 'delta', requestId: job.id, delta });
        }
      });
      if (this.active !== job) return;
      if (typeof rawAnswer !== 'string' || !rawAnswer.trim()) throw new Error('The selected model returned an empty answer. Retry or check the model in AI Settings.');
      const answer = normalizeAnswer(rawAnswer);
      const quality = assessAnswer({ answer, mode, question, hintLevel: this.hintLevel, hasScreen:!!context });
      if (quality.hintViolation) throw new Error('The model returned too much for one hint. Ask for a smaller nudge or choose another model.');
      if (quality.missingCode) throw new Error('The model returned an explanation instead of the requested code. Retry with the language, or provide the missing problem details.');
      if (hintOnly) this.emit({ type: 'delta', requestId: job.id, delta: answer });
      this.history = [...this.history, { role: 'user', content: question }, { role: 'assistant', content: answer }].slice(-this.maxHistory);
      this.hintLevel += 1;
      this.turnCount++;
      this.emit({ type: 'done', requestId: job.id, turn: this.turnCount, answer, warnings: [...quality.issues, ...assessCitations(answer, job.sources || [])], sources: job.sources || [] });
    } catch (error) {
      if (this.active === job) this.emit({ type: 'error', requestId: job.id, message: error.message });
    } finally {
      if (this.active === job) this.active = null;
    }
  }
}

module.exports = { Coordinator };
