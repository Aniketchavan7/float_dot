const test = require('node:test');
const assert = require('node:assert/strict');
const { Coordinator } = require('../src/services/coordinator');
const { buildMessages } = require('../src/services/prompts');

test('real usage: 10 consecutive requests execute sequentially without collision or leakage', async () => {
  const events = [];
  const handledRequestIds = new Set();
  const answersGiven = [];

  const coordinator = new Coordinator({
    emit: event => events.push(event),
    infer: async ({ messages, onDelta, signal }) => {
      // Simulate chunked streaming inference
      signal.throwIfAborted();
      const question = messages.at(-1).content;
      const answer = `Analysis for: ${question}`;
      const chunks = answer.split(' ');
      for (const chunk of chunks) {
        signal.throwIfAborted();
        onDelta(chunk + ' ');
      }
      return answer;
    }
  });

  const context = {
    id: 'active-code-window-01',
    text: 'def solve(nums):\n    pass',
    capturedAt: new Date().toISOString()
  };

  for (let i = 1; i <= 10; i++) {
    const question = `Question ${i}: How should I structure step ${i}?`;
    await coordinator.ask({
      question,
      mode: 'dsa',
      model: 'qwen3:4b',
      context
    });
    answersGiven.push(`Analysis for: ${question}`);
  }

  // 1. Verify 10 distinct request cycles
  const startEvents = events.filter(e => e.type === 'started');
  const doneEvents = events.filter(e => e.type === 'done');
  assert.equal(startEvents.length, 10, 'Expected exactly 10 started events');
  assert.equal(doneEvents.length, 10, 'Expected exactly 10 done events');

  for (const e of startEvents) {
    assert.equal(handledRequestIds.has(e.requestId), false, 'Request IDs must be unique');
    handledRequestIds.add(e.requestId);
  }
  assert.equal(handledRequestIds.size, 10);

  // 2. Verify hint level incremented appropriately
  assert.equal(coordinator.hintLevel, 10, 'Hint level must increment with each successful request on same context');

  // 3. Verify history bounded to last 4 messages (2 conversation turns)
  assert.equal(coordinator.history.length, 4, 'History must be capped at 4 messages');
  assert.equal(coordinator.history[0].content, 'Question 9: How should I structure step 9?');
  assert.equal(coordinator.history.at(-1).content, 'Analysis for: Question 10: How should I structure step 10?');
});

test('real usage: rapid cancellation aborts signal, suppresses stale deltas, and preserves state', async () => {
  const events = [];
  let inferenceAbortSignal = null;
  let releaseInference;
  const inferenceGate = new Promise(resolve => { releaseInference = resolve; });

  const coordinator = new Coordinator({
    emit: event => events.push(event),
    infer: async ({ onDelta, signal }) => {
      inferenceAbortSignal = signal;
      onDelta('chunk1 ');
      await inferenceGate;
      if (signal.aborted) {
        throw new Error('Inference canceled');
      }
      onDelta('chunk2 (should not appear)');
      return 'full answer';
    }
  });

  const context = { id: 'window-cancel-test', text: 'code here', capturedAt: new Date().toISOString() };

  // Start request
  const requestPromise = coordinator.ask({
    question: 'How to optimize?',
    mode: 'dsa',
    model: 'qwen3:4b',
    context
  });

  // Ensure first chunk arrived
  assert.equal(events.some(e => e.type === 'started'), true);
  assert.equal(events.some(e => e.type === 'delta' && e.delta === 'chunk1 '), true);

  // Rapidly cancel while inference is in-flight
  coordinator.cancel();
  assert.equal(inferenceAbortSignal?.aborted, true, 'AbortSignal must be triggered immediately on cancel()');

  // Unblock inference and wait for handler to settle
  releaseInference();
  await requestPromise;

  // Verify cancel event was emitted and no done/stale delta was emitted after cancellation
  assert.equal(events.some(e => e.type === 'canceled'), true, 'Must emit canceled event');
  assert.equal(events.some(e => e.type === 'done'), false, 'Canceled request must not emit done event');
  assert.equal(events.some(e => e.delta?.includes('should not appear')), false, 'Stale deltas must be suppressed');
  assert.deepEqual(coordinator.history, [], 'Canceled request must not pollute conversation history');
  assert.equal(coordinator.hintLevel, 0, 'Canceled request must not increment hint level');
});

test('real usage: rapid back-to-back requests cancel prior jobs and settle on the final request', async () => {
  const completedAnswers = [];
  const abortedSignals = [];
  const events = [];

  const coordinator = new Coordinator({
    emit: event => events.push(event),
    infer: async ({ messages, onDelta, signal }) => {
      signal.addEventListener('abort', () => abortedSignals.push(signal));
      // Give a tiny async delay to simulate network/model latency
      await new Promise(r => setTimeout(r, 20));
      signal.throwIfAborted();
      const ans = `Answer: ${messages.at(-1).content}`;
      onDelta(ans);
      return ans;
    }
  });

  const context = { id: 'burst-window', text: 'int x = 0;', capturedAt: new Date().toISOString() };

  // Fire 5 requests in rapid succession without waiting
  const p1 = coordinator.ask({ question: 'Burst 1', mode: 'debug', model: 'qwen3:4b', context });
  const p2 = coordinator.ask({ question: 'Burst 2', mode: 'debug', model: 'qwen3:4b', context });
  const p3 = coordinator.ask({ question: 'Burst 3', mode: 'debug', model: 'qwen3:4b', context });
  const p4 = coordinator.ask({ question: 'Burst 4', mode: 'debug', model: 'qwen3:4b', context });
  const p5 = coordinator.ask({ question: 'Burst 5', mode: 'debug', model: 'qwen3:4b', context });

  await Promise.all([p1, p2, p3, p4, p5]);

  // Burst 1 through 4 must have been canceled; only Burst 5 completes
  assert.equal(abortedSignals.length, 4, 'Previous 4 requests must have aborted signals');
  const doneEvents = events.filter(e => e.type === 'done');
  assert.equal(doneEvents.length, 1, 'Only the final request must emit done');

  const finalDeltas = events.filter(e => e.type === 'delta');
  assert.equal(finalDeltas.length, 1);
  assert.equal(finalDeltas[0].delta, 'Answer: Burst 5');
  assert.equal(coordinator.hintLevel, 1);
});

test('real usage: follow-ups retain context on same window, clear on window switch or mode switch', async () => {
  const receivedMessagesList = [];
  const coordinator = new Coordinator({
    emit: () => {},
    infer: async ({ messages }) => {
      receivedMessagesList.push(messages);
      return `Answer for ${messages.at(-1).content}`;
    }
  });

  const win1 = { id: 'window-alpha', text: 'Window Alpha Content', capturedAt: new Date().toISOString() };
  const win2 = { id: 'window-beta', text: 'Window Beta Content', capturedAt: new Date().toISOString() };

  // Step 1: First question on win1
  await coordinator.ask({ question: 'What is win1?', mode: 'general', model: 'qwen3:4b', context: win1 });
  assert.equal(coordinator.hintLevel, 1);
  assert.equal(coordinator.history.length, 2);

  // Step 2: Follow-up question on same win1
  await coordinator.ask({ question: 'Can you elaborate?', mode: 'general', model: 'qwen3:4b', context: win1 });
  assert.equal(coordinator.hintLevel, 2);
  assert.equal(coordinator.history.length, 4);

  // Check that Step 2 messages include Step 1 history
  const step2Messages = receivedMessagesList[1];
  assert.equal(step2Messages.some(m => m.content === 'What is win1?'), true);
  assert.equal(step2Messages.some(m => m.content === 'Answer for What is win1?'), true);
  assert.equal(step2Messages.at(-1).content, 'Can you elaborate?');

  // Step 3: Switch window to win2
  await coordinator.ask({ question: 'Now explain win2', mode: 'general', model: 'qwen3:4b', context: win2 });
  assert.equal(coordinator.hintLevel, 1, 'Hint level must reset to 1 after new window answer');
  assert.equal(coordinator.history.length, 2, 'History must contain only win2 turns');

  const step3Messages = receivedMessagesList[2];
  assert.equal(step3Messages.some(m => m.content === 'What is win1?'), false, 'Prior window history must be dropped');
  assert.equal(step3Messages.some(m => m.content.includes('Window Beta Content')), true, 'Must use new window text');

  // Step 4: Switch mode on win2 from 'general' to 'debug'
  await coordinator.ask({ question: 'Debug this code', mode: 'debug', model: 'qwen3:4b', context: win2 });
  assert.equal(coordinator.hintLevel, 1, 'Hint level must reset after mode change');
  assert.equal(coordinator.history.length, 2, 'History must contain only the new mode turn');

  const step4Messages = receivedMessagesList[3];
  assert.equal(step4Messages.some(m => m.content === 'Now explain win2'), false, 'Prior mode history must be dropped');
});

test('real usage: pipeline from audio question and captured window into coordinator', async () => {
  const events = [];
  const coordinator = new Coordinator({
    emit: event => events.push(event),
    infer: async ({ messages, onDelta }) => {
      const q = messages.at(-1).content;
      assert.equal(q, 'What is the runtime complexity of this function?');
      onDelta('The complexity is O(N) because it iterates over the list once.');
      return 'The complexity is O(N) because it iterates over the list once.';
    }
  });

  // Simulated capture + transcription output
  const capturedWindow = {
    id: 'ide-window-101',
    name: 'VS Code - solution.py',
    text: 'def count_nodes(root):\n    if not root: return 0\n    return 1 + count_nodes(root.left) + count_nodes(root.right)',
    capturedAt: new Date().toISOString()
  };

  const transcribedSpokenQuestion = 'What is the runtime complexity of this function?';

  await coordinator.ask({
    question: transcribedSpokenQuestion,
    mode: 'dsa',
    model: 'qwen3:4b',
    context: capturedWindow
  });

  const deltas = events.filter(e => e.type === 'delta');
  assert.equal(deltas.length, 1);
  assert.match(deltas[0].delta, /O\(N\)/);
  assert.equal(events.at(-1).type, 'done');
  assert.equal(coordinator.hintLevel, 1);
});

test('real usage: session memory preserves multi-turn conversation across screen recaptures on same window', async () => {
  const messagesReceived = [];
  const coordinator = new Coordinator({
    maxHistory: 8,
    emit: () => {},
    infer: async ({ messages }) => {
      messagesReceived.push(messages);
      return `Answer for ${messages.at(-1).content}`;
    }
  });

  // Capture 1: Initial capture
  const capture1 = {
    id: 'capture-uuid-1',
    sourceId: 'screen:default',
    name: 'Entire Screen',
    text: 'nums = [2, 7, 11, 15], target = 9',
    capturedAt: new Date().toISOString()
  };

  await coordinator.ask({ question: 'What data structure should I use?', mode: 'dsa', model: 'qwen3:1.7b', context: capture1 });
  assert.equal(coordinator.history.length, 2);
  assert.equal(coordinator.hintLevel, 1);

  // Capture 2: User takes a new screenshot with updated code on the SAME screen
  const capture2 = {
    id: 'capture-uuid-2',
    sourceId: 'screen:default',
    name: 'Entire Screen',
    text: 'seen = {}\nfor i, n in enumerate(nums): pass',
    capturedAt: new Date().toISOString()
  };

  // Follow-up question on capture 2
  await coordinator.ask({ question: 'How do I check complements in the hash map?', mode: 'dsa', model: 'qwen3:1.7b', context: capture2 });
  assert.equal(coordinator.history.length, 4, 'Session memory must retain prior turn despite new capture UUID');
  assert.equal(coordinator.hintLevel, 2);

  // Verify that the prompt sent to LLM included the prior turn
  const secondPromptMessages = messagesReceived[1];
  assert.equal(secondPromptMessages.some(m => m.content === 'What data structure should I use?'), true);
  assert.equal(secondPromptMessages.some(m => m.content === 'Answer for What data structure should I use?'), true);
  assert.equal(secondPromptMessages.at(-1).content, 'How do I check complements in the hash map?');

  // Follow-up question 2
  await coordinator.ask({ question: 'What is the space complexity?', mode: 'dsa', model: 'qwen3:1.7b', context: capture2 });
  assert.equal(coordinator.history.length, 6, 'Session memory must grow to 6 messages across 3 turns');
  assert.equal(coordinator.hintLevel, 3);

  // Clear session
  coordinator.clear();
  assert.equal(coordinator.history.length, 0);
  assert.equal(coordinator.hintLevel, 0);
});

