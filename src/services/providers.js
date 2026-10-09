const local = require('./model');
const { PROVIDERS, modelName, baseURL } = require('../shared/validation');
const { inspectModel, validateModelSelection } = require('./capabilities');

const LABELS = {
  ollama: 'Ollama · local',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  compatible: 'Custom API'
};

function categorizeError(provider, status, errorBody = '') {
  const label = LABELS[provider] || provider;
  if (status === 401 || status === 403) {
    return `${label} authentication failed (HTTP ${status}). Please check or update your API key in AI settings.`;
  }
  if (status === 404) {
    return `${label} model not found (HTTP 404). Check that the model ID is correct and accessible with your account.`;
  }
  if (status === 429) {
    if (/quota|credit|balance|billing|exceeded/i.test(errorBody)) {
      return `${label} API quota or billing limit exceeded. Check your plan on the provider dashboard.`;
    }
    return `${label} rate limit reached (HTTP 429). Please wait a moment before sending another question.`;
  }
  if (status >= 500) {
    return `${label} server is temporarily unavailable (HTTP ${status}). Try again shortly.`;
  }
  return `${label} returned HTTP ${status}. Check your key, model ID, quota and provider settings.`;
}

function requestFor({ provider, model, baseURL: endpoint, apiKey, messages, image }) {
  if (!PROVIDERS.includes(provider)) throw new Error('Unknown AI provider.');
  modelName(model);
  validateModelSelection(provider, model, { sendImage: !!image });

  if (provider !== 'compatible' && !apiKey) throw new Error(`Save your ${LABELS[provider]} API key in AI settings.`);
  const headers = { 'Content-Type': 'application/json' };
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const conversation = messages.filter(m => m.role !== 'system');
  const dataURL = image && `data:image/png;base64,${image}`;

  if (provider === 'openai') {
    headers.Authorization = `Bearer ${apiKey}`;
    const input = messages.map((m, i) => image && i === messages.length - 1
      ? { role: m.role, content: [{ type: 'input_text', text: m.content }, { type: 'input_image', image_url: dataURL }] }
      : m);
    return { url: 'https://api.openai.com/v1/responses', headers, body: { model, input, stream: true, store: false, max_output_tokens: 2048 } };
  }

  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    const input = conversation.map((m, i) => ({
      role: m.role,
      content: image && i === conversation.length - 1
        ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } }, { type: 'text', text: m.content }]
        : m.content
    }));
    return { url: 'https://api.anthropic.com/v1/messages', headers, body: { model, system, messages: input, stream: true, max_tokens: 2048 } };
  }

  if (provider === 'gemini') {
    headers['x-goog-api-key'] = apiKey;
    const contents = conversation.map((m, i) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        { text: m.content },
        ...(image && i === conversation.length - 1 ? [{ inlineData: { mimeType: 'image/png', data: image } }] : [])
      ]
    }));
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}:streamGenerateContent?alt=sse`,
      headers,
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 2048 }
      }
    };
  }

  if (provider === 'compatible') {
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const input = messages.map((m, i) => image && i === messages.length - 1
      ? { role: m.role, content: [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: dataURL } }] }
      : m);
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
  if (input.provider === 'ollama') {
    validateModelSelection('ollama', input.model, { sendImage: !!input.image });
    return local.streamAnswer(input);
  }

  const request = requestFor(input);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    redirect: 'error',
    signal: AbortSignal.any([input.signal, AbortSignal.timeout(120000)])
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errText = await response.text();
      errorDetail = errText.slice(0, 500);
    } catch {}
    throw new Error(categorizeError(input.provider, response.status, errorDetail));
  }

  let answer = '', finished = false;
  await readSSE(response, value => {
    if (value === '[DONE]') return;
    const event = JSON.parse(value);
    let delta = '';

    if (event.error || event.type === 'error' || ['response.failed', 'response.incomplete'].includes(event.type)) {
      const msg = event.error?.message || event.message || 'Provider could not complete the answer.';
      throw new Error(`Provider error: ${msg.slice(0, 200)}`);
    }

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
      const choice = event.choices?.[0];
      delta = choice?.delta?.content || '';
      if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new Error('Provider did not complete a text answer.');
      if (choice?.finish_reason === 'stop') finished = true;
    }

    if (typeof delta !== 'string' || answer.length + delta.length > 24000) throw new Error('Invalid or oversized provider answer.');
    answer += delta;
    if (delta) input.onDelta(delta);
  });

  if (!finished || !answer.trim()) throw new Error('Provider returned an incomplete or empty answer.');
  return answer;
}

/**
 * Performs an explicit, minimal verification check for a provider connection.
 * Sends a minimal request (~1 token) with explicit user trigger to verify credentials, endpoint, and latency.
 * Never executes on passive settings changes.
 */
async function testConnection({ provider, model, baseURL: endpoint, apiKey }) {
  const startTime = Date.now();

  if (provider === 'ollama') {
    const models = await local.listModels();
    const found = models.find(m => m.name === model);
    if (!found) {
      throw new Error(`Ollama model "${model}" is not installed. Download it with "ollama pull ${model}" or select an installed model.`);
    }
    const latencyMs = Date.now() - startTime;
    return {
      ok: true,
      latencyMs,
      model: found.name,
      provider: 'ollama',
      isLocal: true,
      capabilities: inspectModel('ollama', model)
    };
  }

  const request = requestFor({
    provider,
    model,
    baseURL: endpoint,
    apiKey,
    messages: [
      { role: 'system', content: 'Ping' },
      { role: 'user', content: 'Say "pong"' }
    ]
  });

  const testBody = { ...request.body, max_tokens: 5, max_output_tokens: 5 };
  if (testBody.generationConfig) testBody.generationConfig.maxOutputTokens = 5;

  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(testBody),
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errText = await response.text();
      errorDetail = errText.slice(0, 500);
    } catch {}
    throw new Error(categorizeError(provider, response.status, errorDetail));
  }

  if (response.body) {
    const reader = response.body.getReader();
    await reader.cancel().catch(() => {});
  }

  const latencyMs = Date.now() - startTime;
  return {
    ok: true,
    latencyMs,
    provider,
    model,
    isLocal: false,
    capabilities: inspectModel(provider, model)
  };
}

module.exports = {
  streamProvider,
  requestFor,
  readSSE,
  testConnection,
  categorizeError,
  LABELS
};
