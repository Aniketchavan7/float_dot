const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { listModels } = require('../src/services/model');
const { TranscriptionService } = require('../src/services/transcription');
const directory = path.join(__dirname, '..', '.models');
(async () => {
  let models = [];
  try { models = await listModels(); } catch { console.log('Ollama: not reachable at 127.0.0.1:11434'); }
  console.log(JSON.stringify({ ramGB: Math.round(os.totalmem() / 1024 ** 3), cpu: os.cpus()[0]?.model,
    models, ocrReady: fs.existsSync(path.join(directory, 'eng.traineddata')),
    speechReady: await new TranscriptionService(directory, os.tmpdir()).ready() }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
