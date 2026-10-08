const ENDPOINT = 'http://127.0.0.1:11434';
const { modelName } = require('../shared/validation');
async function readJSON(response) {
  if (!response.ok) throw new Error(`Local model server returned HTTP ${response.status}.`);
  return response.json();
}
async function listModels() {
  const data = await readJSON(await fetch(`${ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(4000), redirect: 'error' }));
  return (data.models || []).filter(m => typeof m.name === 'string' && !m.remote_host && !m.remote_model && !/:.*cloud/i.test(m.name)).map(m => ({ name: m.name, size: m.size, digest: m.digest }));
}
async function streamAnswer({ model, messages, signal, onDelta, reasoning = false, image }) {
  modelName(model);
  // Older downloaded Qwen3 templates open a thinking block unconditionally.
  // The model's explicit non-thinking instruction complements the API flag.
  const requestMessages = messages.map((message, index) => index === messages.length - 1 && message.role === 'user'
    ? { ...message, content: /^qwen3[:/]/i.test(model) ? `${message.content}\n${reasoning ? '/think' : '/no_think'}` : message.content,
        ...(image ? { images: [image] } : {}) } : message);
  const timeout = AbortSignal.timeout(120000);
  const response = await fetch(`${ENDPOINT}/api/chat`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, timeout]),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: requestMessages, stream: true, ...(/^qwen3[:/]/i.test(model) ? { think: reasoning } : {}), keep_alive: '5m',
      options: { num_ctx: 8192, num_predict: reasoning ? 2048 : 1024, temperature: 0.3 } })
  });
  if (!response.ok) throw new Error(response.status === 404 ? 'The selected model is not downloaded. Run the local setup command.' : `Local inference failed (HTTP ${response.status}).`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '', answer = '', finished = false;
  function consume(line) {
    if (!line.trim()) return;
    const chunk = JSON.parse(line);
    if (chunk.error) throw new Error('Local inference failed. Check the model server.');
    const delta = chunk.message?.content || '';
    if (delta.length + answer.length > 24000) throw new Error('Answer exceeded the local output limit.');
    answer += delta;
    if (delta) onDelta(delta);
    if (chunk.done) finished = true;
    if (chunk.done && chunk.done_reason === 'length') throw new Error(reasoning ? 'Answer reached the output limit. Ask a narrower question.' : 'Answer reached the output limit. Try the slower reasoning compatibility option in Local setup, or ask a narrower question.');
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 65536) throw new Error('Invalid response from local model server.');
      const lines = pending.split('\n'); pending = lines.pop();
      lines.forEach(consume);
    }
    consume(pending + decoder.decode());
    if (!finished || !answer.trim()) throw new Error('Local model returned an incomplete or empty answer.');
    return answer;
  } finally { await reader.cancel().catch(() => {}); }
}
module.exports = { listModels, streamAnswer, ENDPOINT };
