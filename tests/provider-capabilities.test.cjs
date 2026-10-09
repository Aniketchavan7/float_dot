const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { inspectModel, validateModelSelection } = require('../src/services/capabilities');
const { testConnection, categorizeError, LABELS } = require('../src/services/providers');
const { Coordinator } = require('../src/services/coordinator');

test('capabilities: correctly identifies vision-capable models', () => {
  const visionModels = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-1.5-flash', 'llava:latest', 'qwen2.5-vl:7b'];
  for (const model of visionModels) {
    const info = inspectModel('openai', model);
    assert.equal(info.supportsVision, true, `Expected ${model} to support vision`);
    assert.equal(info.isEmbedding, false);
  }
});

test('capabilities: correctly identifies reasoning/thinking models', () => {
  const reasoningModels = ['o1-preview', 'o3-mini', 'deepseek-r1:8b', 'qwq-32b'];
  for (const model of reasoningModels) {
    const info = inspectModel('openai', model);
    assert.equal(info.supportsReasoning, true, `Expected ${model} to support reasoning`);
  }
});

test('capabilities: detects and flags embedding-only models', () => {
  const embeddingModels = [
    'text-embedding-3-small',
    'text-embedding-ada-002',
    'bge-large-en-v1.5',
    'nomic-embed-text',
    'all-minilm-l6-v2'
  ];
  for (const model of embeddingModels) {
    const info = inspectModel('ollama', model);
    assert.equal(info.isEmbedding, true, `Expected ${model} to be flagged as embedding`);
    assert.ok(info.warning.includes('embedding-only'));
  }
});

test('capabilities: validateModelSelection blocks embedding models and incompatible vision requests', () => {
  // Embedding model must throw
  assert.throws(
    () => validateModelSelection('openai', 'text-embedding-3-small'),
    /embedding model and cannot generate conversational answers/i
  );

  // Text-only model with sendImage must throw
  assert.throws(
    () => validateModelSelection('openai', 'gpt-3.5-turbo', { sendImage: true }),
    /does not support image inputs/i
  );

  // Vision model with sendImage succeeds
  const visionOk = validateModelSelection('openai', 'gpt-4o', { sendImage: true });
  assert.equal(visionOk.supportsVision, true);

  // Text-only model without sendImage succeeds
  const textOk = validateModelSelection('openai', 'gpt-3.5-turbo', { sendImage: false });
  assert.equal(textOk.supportsVision, false);
});

test('providers: categorizeError provides actionable recovery messages without secret leakage', () => {
  const authErr = categorizeError('openai', 401, 'Unauthorized');
  assert.ok(authErr.includes('authentication failed (HTTP 401)'));
  assert.ok(authErr.includes('check or update your API key'));

  const notFoundErr = categorizeError('anthropic', 404, 'Not Found');
  assert.ok(notFoundErr.includes('model not found (HTTP 404)'));

  const quotaErr = categorizeError('gemini', 429, 'Resource has been exhausted (e.g. check quota)');
  assert.ok(quotaErr.includes('API quota or billing limit exceeded'));

  const rateLimitErr = categorizeError('compatible', 429, 'Too many requests');
  assert.ok(rateLimitErr.includes('rate limit reached (HTTP 429)'));

  const serverErr = categorizeError('ollama', 503, 'Service Unavailable');
  assert.ok(serverErr.includes('temporarily unavailable (HTTP 503)'));
});

test('providers: testConnection verifies endpoint with minimal verification payload and returns latency', async () => {
  let receivedBody = null;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    receivedBody = JSON.parse(body);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'chatcmpl-test',
      choices: [{ message: { content: 'pong' } }]
    }));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const result = await testConnection({
      provider: 'compatible',
      model: 'test-model',
      baseURL: `http://127.0.0.1:${port}`,
      apiKey: 'test-key'
    });

    assert.equal(result.ok, true);
    assert.ok(result.latencyMs >= 0);
    assert.equal(result.provider, 'compatible');
    assert.equal(result.model, 'test-model');
    // Ensure minimal max_tokens was sent to save user quota
    assert.equal(receivedBody.max_tokens, 5);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('providers: testConnection accurately surfaces structured error on 401 auth failure', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    await assert.rejects(
      () => testConnection({
        provider: 'compatible',
        model: 'test-model',
        baseURL: `http://127.0.0.1:${port}`,
        apiKey: 'bad-key'
      }),
      /authentication failed \(HTTP 401\)/i
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('coordinator: request snapshot isolates in-flight execution from external settings mutations', async () => {
  let modelReceivedByInfer = null;
  const coordinator = new Coordinator({
    infer: async ({ model }) => {
      modelReceivedByInfer = model;
      // Simulate slow inference
      await new Promise(resolve => setTimeout(resolve, 50));
      return '### Summary\n- Snapshot verification';
    },
    emit: () => {}
  });

  const snapshot = {
    provider: 'openai',
    model: 'gpt-4o-snapshot',
    reasoning: false
  };

  const askPromise = coordinator.ask({
    question: 'Testing snapshot',
    mode: 'general',
    context: { id: 'c1', sourceId: 'screen:default', text: 'code' },
    model: 'gpt-4o-snapshot',
    snapshot
  });

  // Mutate snapshot object or simulate external settings change
  snapshot.model = 'mutated-mid-flight';

  await askPromise;
  assert.equal(modelReceivedByInfer, 'gpt-4o-snapshot');
});
