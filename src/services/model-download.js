const {modelName} = require('../shared/validation');
const {ENDPOINT} = require('./model');
async function downloadModel(model, signal, progress, fetcher = fetch) {
  modelName(model);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(model) || /(?:https?:|cloud)/i.test(model)) throw new Error('Enter a local Ollama model name, such as qwen3:1.7b.');
  const response = await fetcher(`${ENDPOINT}/api/pull`, {
    method:'POST', redirect:'error', signal:AbortSignal.any([signal,AbortSignal.timeout(3600000)]),
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({model,stream:true})
  });
  if (!response.ok) throw new Error(`Ollama download failed (HTTP ${response.status}). Start Ollama and check the model name.`);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', success = false;
  function consume(line) {
    if (!line.trim()) return;
    const value = JSON.parse(line);
    if (value.error) throw new Error(String(value.error).slice(0,300));
    if (value.status === 'success') success = true;
    progress({message:String(value.status || 'Downloading model').slice(0,200),bytes:Number(value.completed)||0});
  }
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      pending += decoder.decode(value,{stream:true});
      if (pending.length > 128000) throw new Error('Ollama progress response exceeded limit.');
      const lines = pending.split('\n'); pending = lines.pop(); lines.forEach(consume);
    }
    consume(pending + decoder.decode());
    signal.throwIfAborted();
    if (!success) throw new Error('Model download ended before completion. Retry to resume.');
  } finally { await reader.cancel().catch(()=>{}); }
}
module.exports = {downloadModel};
