const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
async function findExecutable(directory) {
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.name === 'whisper-cli.exe') return target;
      if (entry.isDirectory()) { const result = await findExecutable(target); if (result) return result; }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return null;
}
class TranscriptionService {
  constructor(modelDirectory, tempDirectory) { this.directory = modelDirectory; this.temp = tempDirectory; }
  async ready() { return !!await findExecutable(path.join(this.directory, 'whisper')) && !!await fs.stat(path.join(this.directory, 'ggml-base.bin')).catch(() => null); }
  async transcribe(wav, signal) {
    const executable = await findExecutable(path.join(this.directory, 'whisper'));
    const model = path.join(this.directory, 'ggml-base.bin');
    if (!executable || !await fs.stat(model).catch(() => null)) throw new Error('Local speech model/runtime missing. Run npm run setup:local.');
    await fs.mkdir(this.temp, { recursive: true });
    const file = path.join(this.temp, `${randomUUID()}.wav`);
    await fs.writeFile(file, wav, { mode: 0o600 });
    try {
      signal.throwIfAborted();
      const output = await new Promise((resolve, reject) => {
        const child = spawn(executable, ['-m', model, '-f', file, '-l', 'en', '-nt', '-np', '-t', '6'],
          { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', settled = false;
        const settle = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
        const abort = () => { child.kill(); settle(new Error('Recording transcription canceled.')); };
        const timer = setTimeout(() => { child.kill(); settle(new Error('Speech transcription timed out. Try a shorter question.')); }, 90000);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        child.stdout.on('data', data => { stdout += data; if (stdout.length > 20000) { child.kill(); settle(new Error('Speech output exceeded limit.')); } });
        child.stderr.on('data', data => { if (stderr.length < 2000) stderr += data; });
        child.on('error', () => settle(new Error('Unable to start local speech runtime. Check the downloaded files.')));
        child.on('close', code => settle(code === 0 ? null : new Error('Local speech runtime failed. Check model/runtime compatibility.'), stdout));
      });
      const transcript = output.replace(/\[[\d:.\s\->]+\]/g, '').replace(/\[BLANK_AUDIO\]|\[SILENCE\]/gi, '').trim();
      if (!transcript || /^(thank you|thanks for watching|you)[.!\s]*$/i.test(transcript)) throw new Error('No clear question heard. Please record again.');
      if (transcript.length > 2000) throw new Error('Question is too long. Please shorten it.');
      return transcript;
    } finally { await fs.rm(file, { force: true }); }
  }
  async transcribeSegment(wav, signal) {
    const executable = await findExecutable(path.join(this.directory, 'whisper'));
    const model = path.join(this.directory, 'ggml-base.bin');
    if (!executable || !await fs.stat(model).catch(() => null)) throw new Error('Local speech model/runtime missing. Run npm run setup:local.');
    await fs.mkdir(this.temp, { recursive: true });
    const file = path.join(this.temp, `${randomUUID()}.wav`);
    await fs.writeFile(file, wav, { mode: 0o600 });
    try {
      signal.throwIfAborted();
      const output = await new Promise((resolve, reject) => {
        const child = spawn(executable, ['-m', model, '-f', file, '-l', 'en', '-nt', '-np', '-t', '6'],
          { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', settled = false;
        const settle = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
        const abort = () => { child.kill(); settle(new Error('Transcription canceled.')); };
        const timer = setTimeout(() => { child.kill(); settle(new Error('Segment transcription timed out.')); }, 60000);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        child.stdout.on('data', data => { stdout += data; if (stdout.length > 20000) { child.kill(); settle(new Error('Speech output exceeded limit.')); } });
        child.stderr.on('data', data => { if (stderr.length < 2000) stderr += data; });
        child.on('error', () => settle(new Error('Unable to start local speech runtime.')));
        child.on('close', code => settle(code === 0 ? null : new Error('Local speech runtime failed.'), stdout));
      });
      const transcript = output.replace(/\[[\d:.\s\->]+\]/g, '').replace(/\[BLANK_AUDIO\]|\[SILENCE\]/gi, '').trim();
      if (!transcript || /^(thank you|thanks for watching|you)[.!\s]*$/i.test(transcript)) return '';
      return transcript.slice(0, 2000);
    } finally { await fs.rm(file, { force: true }); }
  }
}
module.exports = { TranscriptionService, findExecutable };
