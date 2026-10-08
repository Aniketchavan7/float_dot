const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildMessages } = require('../src/services/prompts');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/eval-corpus.json'), 'utf8'));

test('evaluation corpus contains 30 valid cases with 10 in each mode', () => {
  assert.equal(corpus.length, 30);
  const dsaCases = corpus.filter(c => c.mode === 'dsa');
  const debugCases = corpus.filter(c => c.mode === 'debug');
  const generalCases = corpus.filter(c => c.mode === 'general');

  assert.equal(dsaCases.length, 10);
  assert.equal(debugCases.length, 10);
  assert.equal(generalCases.length, 10);

  for (const c of corpus) {
    assert.ok(c.id, 'Every case must have an id');
    assert.ok(c.name, 'Every case must have a name');
    assert.ok(c.screenText && c.screenText.length > 10, 'Every case must have screenText');
    assert.ok(c.spokenQuestion && c.spokenQuestion.length > 5, 'Every case must have a spokenQuestion');
    assert.ok(Array.isArray(c.requiredKeywords) && c.requiredKeywords.length > 0, 'Every case must have requiredKeywords');
  }
});

test('DSA evaluation cases configure hintLevel=0 without full solution leaks', () => {
  const dsaCases = corpus.filter(c => c.mode === 'dsa');
  for (const c of dsaCases) {
    const messages = buildMessages({
      mode: 'dsa',
      question: c.spokenQuestion,
      context: { id: c.id, text: c.screenText, capturedAt: '2026-10-08T00:00:00Z' },
      hintLevel: 0
    });

    assert.equal(messages[0].role, 'system');
    assert.match(messages[0].content, /Current hint level: 0/);
    assert.match(messages[0].content, /Do not reveal full code or the complete algorithm/);
    assert.equal(messages.at(-1).content, c.spokenQuestion);
  }
});

test('Debug evaluation cases enforce structured root-cause analysis', () => {
  const debugCases = corpus.filter(c => c.mode === 'debug');
  for (const c of debugCases) {
    const messages = buildMessages({
      mode: 'debug',
      question: c.spokenQuestion,
      context: { id: c.id, text: c.screenText, capturedAt: '2026-10-08T00:00:00Z' }
    });

    assert.match(messages[0].content, /Explain the visible error/);
    assert.match(messages[0].content, /Observed, Likely cause, and Next check/);
    assert.match(messages[0].content, /Show commands only as suggestions/);
  }
});
