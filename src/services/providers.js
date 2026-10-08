const local = require('./model');
const { PROVIDERS, modelName, baseURL } = require('../shared/validation');
const LABELS = { ollama: 'Ollama · local', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini', compatible: 'Custom API' };
function requestFor({ provider, model, baseURL: endpoint, apiKey, messages, image }) {
  if (!PROVIDERS.includes(provider)) throw new Error('Unknown AI provider.');
  modelName(model);
  if (provider !== 'compatible' && !apiKey) throw new Error(`Save your ${LABELS[provider]} API key in AI settings.`);
  const headers = { 'Content-Type': 'application/json' };
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const conversation = messages.filter(m => m.role !== 'system');
  const dataURL = image && `data:image/png;base64,${image}`;
  if (provider === 'openai') {
    headers.Authorization = `Bearer ${apiKey}`;
    const input = messages.map((m, i) => image && i === messages.length - 1 ? { role: m.role, content: [{ type: 'input_text', text: m.content }, { type: 'input_image', image_url: dataURL }] } : m);
    return { url: 'https://api.openai.com/v1/responses', headers, body: { model, input, stream: true, store: false, max_output_tokens: 2048 } };
  }
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01';
    const input = conversation.map((m, i) => ({ role: m.role, content: image && i === conversation.length - 1
      ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } }, { type: 'text', text: m.content }] : m.content }));
    return { url: 'https://api.anthropic.com/v1/messages', headers, body: { model, system, messages: input, stream: true, max_tokens: 2048 } };
  }
  if (provider === 'gemini') {
    headers['x-goog-api-key'] = apiKey;
    const contents = conversation.map((m, i) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }, ...(image && i === conversation.length - 1 ? [{ inlineData: { mimeType: 'image/png', data: image } }] : [])] }));
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}:streamGenerateContent?alt=sse`, headers,
      body: { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 2048 } } };
  }
  if (provider === 'compatible') {
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const input = messages.map((m, i) => image && i === messages.length - 1 ? { role: m.role, content: [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: dataURL } }] } : m);
    return { url: `${baseURL(endpoint)}/chat/completions`, headers, body: { model, messages: input, stream: true, max_tokens: 2048 } };
  }
  throw new Error('Use the local adapter for Ollama.');
}
async function readSSE(response, onEvent) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', data = [];
  function line(value) {
    if (!value) { if (data.length) onEvent(data.join('\n')); data = []; }
    else if (value.startsWith('data:')) data.push(value.slice(5).trimStart());
  }
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      if (pending.length + data.join('').length > 1024 * 1024) throw new Error('Provider stream exceeded the event limit.');
      const lines = pending.split('\n'); pending = lines.pop(); lines.forEach(value => line(value.replace(/\r$/, '')));
    }
    pending += decoder.decode(); if (pending) line(pending.replace(/\r$/, '')); line('');
  } finally { await reader.cancel().catch(() => {}); }
}
async function streamProvider(input) {
  if (input.provider === 'ollama') return local.streamAnswer(input);
  const request = requestFor(input);
  const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), redirect: 'error',
    signal: AbortSignal.any([input.signal, AbortSignal.timeout(120000)]) });
  if (!response.ok) throw new Error(`${LABELS[input.provider]} returned HTTP ${response.status}. Check your key, model ID, quota and provider settings.`);
  let answer = '', finished = false;
  await readSSE(response, value => {
    if (value === '[DONE]') return;
    const event = JSON.parse(value); let delta = '';
    if (event.error || event.type === 'error' || ['response.failed', 'response.incomplete'].includes(event.type)) throw new Error('Provider could not complete the answer. Check the model or ask a shorter question.');
    if (input.provider === 'openai') {
      if (event.type === 'response.output_text.delta') delta = event.delta;
      if (event.type === 'response.completed') finished = true;
    } else if (input.provider === 'anthropic') {
      if (event.delta?.type === 'text_delta') delta = event.delta.text;
      if (event.delta?.stop_reason === 'max_tokens') throw new Error('Answer reached the output limit.');
      if (event.type === 'message_stop') finished = true;
    } else if (input.provider === 'gemini') {
      const candidate = event.candidates?.[0];
      delta = (candidate?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Gemini did not complete the answer. Try a different question or model.');
      if (candidate?.finishReason === 'STOP') finished = true;
      if (event.promptFeedback?.blockReason) throw new Error('Gemini could not answer this request.');
    } else {
      const choice = event.choices?.[0]; delta = choice?.delta?.content || '';
      if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new Error('Provider did not complete a text answer.');
      if (choice?.finish_reason === 'stop') finished = true;
    }
    if (typeof delta !== 'string' || answer.length + delta.length > 24000) throw new Error('Invalid or oversized provider answer.');
    answer += delta; if (delta) input.onDelta(delta);
  });
  if (!finished || !answer.trim()) throw new Error('Provider returned an incomplete or empty answer.');
  return answer;
}
module.exports = { streamProvider, requestFor, readSSE, LABELS };
