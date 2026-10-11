const fs = require('node:fs/promises');
const path = require('node:path');
const { createReadStream, createWriteStream } = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');
const { atomicWrite } = require('./settings');

// Pinned content hashes from the previously audited downloads manifest.
// A changed upstream object fails closed, even if its URL uses a branch alias.
const ASSETS = {
  ocr: [
    ['eng.traineddata', 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata', '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2'],
    ['OCR-DATA-LICENSE.txt', 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/LICENSE', 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30']
  ],
  speech: [
    ['whisper-runtime.zip', 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip', '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb'],
    ['ggml-base.bin', 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin', '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'],
    ['WHISPER-LICENSE.txt', 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/b5454/LICENSE', '94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d']
  ]
};
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function extract(zip, destination, signal) {
  const quote = value => "'" + value.replace(/'/g, "''") + "'";
  const command = `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${quote(zip)} -DestinationPath ${quote(destination)} -Force`;
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'ignore' });
    const abort = () => child.kill();
    signal.addEventListener('abort', abort, {once:true});
    if (signal.aborted) abort();
    child.on('error', reject);
    child.on('close', code => { signal.removeEventListener('abort', abort); code === 0 && !signal.aborted ? resolve() : reject(new Error('Speech extraction stopped or failed. Retry installation.')); });
  });
}
class AssetInstaller {
  constructor(directory, {fetcher = fetch, unpack = extract, manifest = ASSETS} = {}) {
    Object.assign(this, {directory:path.resolve(directory), fetcher, unpack, manifest});
    this.active = null;
  }
  cancel() { this.active?.abort(); }
  async installed(kind) {
    try {
      const name = JSON.parse(await fs.readFile(path.join(this.directory, `${kind}.json`), 'utf8')).directory;
      if (typeof name !== 'string' || !name.startsWith(`${kind}-`) || path.basename(name) !== name) return null;
      const directory = path.join(this.directory, name);
      return (await fs.stat(directory)).isDirectory() ? directory : null;
    } catch { return null; }
  }
  async install(kind, onProgress = () => {}) {
    if (!Object.hasOwn(this.manifest, kind)) throw new Error('Choose OCR or speech assets.');
    if (this.active) throw new Error('Another download is already running.');
    const controller = new AbortController(); this.active = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(900000)]);
    const stage = path.join(this.directory, `.install-${randomUUID()}`);
    try {
      await fs.mkdir(stage, {recursive:true});
      for (const [name, url, expected] of this.manifest[kind]) {
        const file = path.join(stage, name);
        onProgress({kind, message:`Downloading ${name}`, bytes:0});
        const response = await this.fetcher(url, {signal});
        if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}). Retry when online.`);
        let bytes = 0, last = 0;
        const meter = new Transform({transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > 600000000) return callback(new Error('Asset exceeds size limit.'));
          if (Date.now() - last > 200) { last = Date.now(); onProgress({kind, message:`Downloading ${name}`, bytes}); }
          callback(null, chunk);
        }});
        await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(file, {flags:'wx'}), {signal});
        if (await digest(file) !== expected) throw new Error(`Integrity check failed for ${name}. No assets were installed.`);
      }
      if (kind === 'speech') {
        onProgress({kind, message:'Extracting verified speech runtime', bytes:0});
        await this.unpack(path.join(stage, 'whisper-runtime.zip'), path.join(stage, 'whisper'), signal);
      }
      signal.throwIfAborted();
      // Versioned directory keeps existing assets usable throughout download/extraction.
      const destination = path.join(this.directory, `${kind}-${randomUUID()}`);
      await fs.rename(stage, destination);
      await atomicWrite(path.join(this.directory, `${kind}.json`), JSON.stringify({directory:path.basename(destination)}));
      return destination;
    } finally {
      try {
        if (path.dirname(stage) !== path.resolve(this.directory)) throw new Error('Invalid staging path.');
        await fs.rm(stage, {recursive:true,force:true});
      } finally { this.active = null; }
    }
  }
}
module.exports = {AssetInstaller, ASSETS, digest};
