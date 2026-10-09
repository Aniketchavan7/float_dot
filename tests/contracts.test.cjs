const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {
  PROVIDER_CAPABILITIES,
  validateCaptureContext,
  validateAnswerEvent,
  validateVoiceResult,
  INTENT_TO_MODE,
  MODE_TO_INTENT
} = require('../src/shared/contracts');
const { Coordinator } = require('../src/services/coordinator');

test('contracts: provider capabilities contain accurate metadata for all 5 providers', () => {
  const providers = ['ollama', 'openai', 'anthropic', 'gemini', 'compatible'];
  for (const p of providers) {
    const caps = PROVIDER_CAPABILITIES[p];
    assert.ok(caps, `Missing capability definition for ${p}`);
    assert.equal(typeof caps.label, 'string');
    assert.equal(typeof caps.supportsVision, 'boolean');
    assert.equal(typeof caps.supportsStreaming, 'boolean');
    assert.equal(typeof caps.requiresKey, 'boolean');
    assert.equal(typeof caps.isLocal, 'boolean');
  }
  assert.equal(PROVIDER_CAPABILITIES.ollama.isLocal, true);
  assert.equal(PROVIDER_CAPABILITIES.ollama.requiresKey, false);
  assert.equal(PROVIDER_CAPABILITIES.openai.requiresKey, true);
});

test('contracts: intent mapping is bidirectional between UX intents and service modes', () => {
  assert.equal(INTENT_TO_MODE.explain, 'general');
  assert.equal(INTENT_TO_MODE.hint, 'dsa');
  assert.equal(INTENT_TO_MODE.debug, 'debug');
  assert.equal(INTENT_TO_MODE.meeting, 'meeting');

  assert.equal(MODE_TO_INTENT.general, 'explain');
  assert.equal(MODE_TO_INTENT.dsa, 'hint');
  assert.equal(MODE_TO_INTENT.debug, 'debug');
  assert.equal(MODE_TO_INTENT.meeting, 'meeting');
});

test('contracts: all M00 fixtures validate against contract schemas', () => {
  const fixturePath = path.join(__dirname, 'fixtures/contract-fixtures.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  // Validate capturing context
  const captureCtx = validateCaptureContext(fixtures.capturing.captureContext);
  assert.equal(captureCtx.id, 'cap-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  assert.equal(captureCtx.quality.confidence, 98.5);

  // Validate answering events
  const started = validateAnswerEvent(fixtures.answering.startedEvent);
  assert.equal(started.type, 'started');
  assert.equal(started.requestId, fixtures.answering.requestId);

  for (const delta of fixtures.answering.deltaEvents) {
    const validatedDelta = validateAnswerEvent(delta);
    assert.equal(validatedDelta.type, 'delta');
    assert.equal(validatedDelta.requestId, fixtures.answering.requestId);
  }

  // Validate completion event
  const done = validateAnswerEvent(fixtures.completion);
  assert.equal(done.type, 'done');
  assert.equal(done.turn, 1);
  assert.ok(done.answer.includes('### Summary'));

  // Validate incomplete output fixture
  const incomplete = validateAnswerEvent(fixtures.incomplete_output);
  assert.equal(incomplete.type, 'done');
  assert.ok(incomplete.warnings.length > 0);

  // Validate recoverable failures
  for (const failure of fixtures.recoverable_failures) {
    const err = validateAnswerEvent(failure);
    assert.equal(err.type, 'error');
    assert.ok(err.message.length > 0);
  }
});

test('contracts: Coordinator emits events strictly conforming to AnswerEvent contract', async () => {
  const emittedEvents = [];
  const coordinator = new Coordinator({
    infer: async ({ onDelta }) => {
      onDelta('Chunk 1 ');
      onDelta('Chunk 2');
      return '### Summary\n- Valid response chunk';
    },
    emit: event => {
      validateAnswerEvent(event);
      emittedEvents.push(event);
    }
  });

  await coordinator.ask({
    question: 'How do I optimize this search?',
    mode: 'general',
    context: {
      id: 'cap-123',
      sourceId: 'screen:default',
      capturedAt: new Date().toISOString(),
      text: 'const x = 1;'
    },
    model: 'qwen3:1.7b'
  });

  assert.equal(emittedEvents[0].type, 'started');
  assert.equal(emittedEvents[1].type, 'delta');
  assert.equal(emittedEvents[emittedEvents.length - 1].type, 'done');
  assert.equal(emittedEvents[emittedEvents.length - 1].turn, 1);

  // All events must share the identical requestId
  const reqId = emittedEvents[0].requestId;
  assert.ok(reqId && typeof reqId === 'string');
  for (const ev of emittedEvents) {
    assert.equal(ev.requestId, reqId);
  }
});

test('contracts: stale events from previous canceled request are ignored', async () => {
  let savedOnDelta = null;
  const emittedEvents = [];
  const coordinator = new Coordinator({
    infer: ({ onDelta, signal }) => {
      savedOnDelta = onDelta;
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    },
    emit: event => {
      validateAnswerEvent(event);
      emittedEvents.push(event);
    }
  });

  const p = coordinator.ask({
    question: 'First question',
    mode: 'general',
    context: { id: 'c1', sourceId: 'screen:default', text: 'code 1' },
    model: 'qwen3:1.7b'
  });

  // Cancel immediately
  coordinator.cancel();
  await p;

  assert.equal(emittedEvents.length, 2);
  assert.equal(emittedEvents[0].type, 'started');
  assert.equal(emittedEvents[1].type, 'canceled');

  // If delayed delta arrives after cancel, it must NOT be emitted
  savedOnDelta('delayed rogue chunk');
  assert.equal(emittedEvents.length, 2);
});
