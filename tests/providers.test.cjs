const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { requestFor, streamProvider } = require('../src/services/providers');
const { CredentialStore } = require('../src/services/credentials');
const { validateSettings } = require('../src/shared/validation');
const messages = [{ role: 'system', content: 'Use the screenshot as evidence.' }, { role: 'user', content: 'Explain this.' }];
const common = { model: 'user-selected-model', apiKey: 'test-key', messages, image: 'aW1hZ2U=', baseURL: 'https://example.test/v1' };
const fixtures = {
  openai: [{ type: 'response.output_text.delta', delta: 'héllo' }, { type: 'response.completed' }],
  anthropic: [{ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'do not show' } }, { type: 'content_block_delta', delta: { type: 'text_delta', text: 'héllo' } }, { type: 'message_stop' }],
  gemini: [{ candidates: [{ content: { parts: [{ thought: true, text: 'do not show' }, { text: 'héllo' }] }, finishReason: 'STOP' }] }],
  compatible: [{ choices: [{ delta: { content: 'héllo' } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }]
};
function fragmented(events) {
  const bytes = Buffer.from(events.map(event => `event: message\r\ndata: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.subarray(i, i + 7)); controller.close(); } }));
}
for (const provider of Object.keys(fixtures)) {
  test(`${provider}: streams split SSE, preserves selected model and sends image only when supplied`, async () => {
    const original = global.fetch; let seen;
    try {
      global.fetch = async (url, options) => { seen = { url, ...options, body: JSON.parse(options.body) }; return fragmented(fixtures[provider]); };
      let shown = '';
      const answer = await streamProvider({ ...common, provider, signal: new AbortController().signal, onDelta: text => { shown += text; } });
      assert.equal(answer, 'héllo'); assert.equal(shown, answer); assert.equal(seen.redirect, 'error');
      assert.ok(JSON.stringify(seen.body).includes(common.image));
      assert.ok(!JSON.stringify(seen.body).includes(common.apiKey));
      assert.ok(!seen.url.includes(common.apiKey));
      const textOnly = requestFor({ ...common, provider, image: undefined });
      assert.ok(!JSON.stringify(textOnly.body).includes(common.image));
      if (provider === 'gemini') assert.match(seen.url, /user-selected-model:streamGenerateContent/);
      else assert.equal(seen.body.model, common.model);
    } finally { global.fetch = original; }
  });
}
test('provider errors never retry another destination or expose server error bodies', async () => {
  const original = global.fetch; let calls = 0;
  try {
    global.fetch = async () => { calls++; return new Response('server echoed test-key and private screenshot', { status: 401 }); };
    await assert.rejects(streamProvider({ ...common, provider: 'openai', signal: new AbortController().signal, onDelta: () => {} }), error => /HTTP 401/.test(error.message) && !/test-key|private/.test(error.message));
    assert.equal(calls, 1);
    global.fetch = async () => fragmented([{ type: 'response.output_text.delta', delta: 'partial' }]);
    await assert.rejects(streamProvider({ ...common, provider: 'openai', signal: new AbortController().signal, onDelta: () => {} }), /incomplete/);
  } finally { global.fetch = original; }
});
test('provider cancellation is propagated to fetch', async () => {
  const original = global.fetch; const controller = new AbortController(); controller.abort();
  try {
    global.fetch = async (_url, options) => { options.signal.throwIfAborted(); };
    await assert.rejects(streamProvider({ ...common, provider: 'gemini', signal: controller.signal, onDelta: () => {} }), { name: 'AbortError' });
  } finally { global.fetch = original; }
});
test('custom endpoint validation allows HTTPS and loopback, rejects credentials and insecure remote hosts', () => {
  assert.equal(validateSettings({ model: 'any-family/model:latest', provider: 'compatible', baseURL: 'http://localhost:1234/v1/' }).baseURL, 'http://localhost:1234/v1');
  for (const url of ['http://remote.test/v1', 'https://key@host.test/v1', 'https://host.test/v1?key=secret', 'file:///data']) assert.throws(() => validateSettings({ baseURL: url }));
  assert.throws(() => requestFor({ ...common, provider: 'openai', apiKey: '' }), /API key/);
});
test('credentials are encrypted on disk and bound to a provider or custom endpoint', async () => {
  const parent = path.resolve(__dirname, '../.artifacts'); await fs.mkdir(parent, { recursive: true });
  const directory = await fs.mkdtemp(path.join(parent, 'credential-test-'));
  const encryption = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from([...value].reverse().join('')), decryptString: value => [...value.toString()].reverse().join('') };
  try {
    const store = new CredentialStore(directory, encryption); await store.load();
    await store.set({ provider: 'openai' }, 'synthetic-test-key');
    assert.ok(!(await fs.readFile(store.file, 'utf8')).includes('synthetic-test-key'));
    const reloaded = new CredentialStore(directory, encryption); await reloaded.load();
    assert.equal(reloaded.get({ provider: 'openai' }), 'synthetic-test-key');
    assert.equal(reloaded.get({ provider: 'anthropic' }), '');
    await reloaded.set({ provider: 'compatible', baseURL: 'https://one.test/v1' }, 'custom-key');
    assert.equal(reloaded.get({ provider: 'compatible', baseURL: 'https://two.test/v1' }), '');
    await reloaded.set({ provider: 'openai' }, ''); assert.equal(reloaded.get({ provider: 'openai' }), '');
    const unavailable = new CredentialStore(directory, { isEncryptionAvailable: () => false });
    assert.throws(() => unavailable.set({ provider: 'openai' }, 'key'), /encryption/);
  } finally { assert.equal(path.dirname(directory), parent); await fs.rm(directory, { recursive: true, force: true }); }
});
