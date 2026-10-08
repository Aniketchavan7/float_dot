const fs = require('node:fs/promises');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { OcrService } = require('../src/services/ocr');
const { TranscriptionService } = require('../src/services/transcription');
const { listModels, streamAnswer } = require('../src/services/model');
const { buildMessages } = require('../src/services/prompts');
const root = path.join(__dirname, '..'), assets = path.join(root, '.models');
(async () => {
  const signal = AbortSignal.timeout(180000), timing = {};
  const models = await listModels();
  if (!models.some(m => m.name === 'qwen3:4b')) throw new Error('Qwen3 4B is not downloaded yet.');
  let started = performance.now();
  const extracted = await new OcrService(assets).read(await fs.readFile(path.join(root, '.artifacts/ocr-fixture.png')), signal);
  timing.ocrMs = Math.round(performance.now() - started);
  if (!/two sum/i.test(extracted.text) || !/target/i.test(extracted.text)) throw new Error('OCR did not recover the synthetic problem.');
  started = performance.now();
  const transcript = await new TranscriptionService(assets, path.join(root, '.artifacts/temp-media')).transcribe(await fs.readFile(path.join(root, '.artifacts/question.wav')), signal);
  timing.asrMs = Math.round(performance.now() - started);
  if (!/hint/i.test(transcript) || !/target/i.test(transcript)) throw new Error('ASR did not recover the synthetic request.');
  started = performance.now(); let first = null;
  const answer = await streamAnswer({ model: 'qwen3:4b', signal,
    messages: buildMessages({ mode: 'dsa', question: transcript, context: { text: extracted.text, capturedAt: new Date().toISOString() } }),
    onDelta: () => { first ??= performance.now(); } });
  timing.firstTokenMs = Math.round(first - started); timing.modelTotalMs = Math.round(performance.now() - started);
  if (answer.length < 20) throw new Error('Model did not provide a useful-length answer.');
  const report = { checkedAt: new Date().toISOString(), syntheticOnly: true, model: models.find(m => m.name === 'qwen3:4b'), timing,
    transcript, extracted: extracted.text, answer, limitation: 'One synthetic local pipeline example, not the thirty-case corpus or live microphone certification.' };
  await fs.writeFile(path.join(root, '.artifacts/local-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
