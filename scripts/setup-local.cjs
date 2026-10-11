// Network access occurs only in this explicitly invoked setup command.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { createWriteStream } = require('node:fs');
const directory = path.join(__dirname, '..', '.models');
async function download(url, filename, expectedHash) {
  const destination = path.join(directory, filename);
  if (await fs.stat(destination).catch(() => null)) {
    const hash = crypto.createHash('sha256').update(await fs.readFile(destination)).digest('hex');
    if (expectedHash && hash !== expectedHash) throw new Error(`Existing file failed checksum: ${filename}. Move it aside before retrying.`);
    console.log(`${filename}: verified`); return;
  }
  console.log(`Downloading ${filename} from ${new URL(url).hostname}…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(900000) });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const temp = `${destination}.partial`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
    const hash = crypto.createHash('sha256').update(await fs.readFile(temp)).digest('hex');
    if (expectedHash && hash !== expectedHash) throw new Error(`Checksum mismatch for ${filename}`);
    await fs.rename(temp, destination);
    manifest.push({ filename, url, sha256: hash, checkedAgainstPublishedDigest: !!expectedHash });
  } finally { await fs.rm(temp, { force: true }); }
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
const manifest = [];
(async () => {
  await fs.mkdir(directory, { recursive: true });
  await download('https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip', 'whisper-runtime.zip',
    '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb');
  await download('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin', 'ggml-base.bin', '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe');
  await download('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata', 'eng.traineddata', '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2');
  await download('https://raw.githubusercontent.com/ggml-org/whisper.cpp/b5454/LICENSE', 'WHISPER-LICENSE.txt', '94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d');
  await download('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/LICENSE', 'OCR-DATA-LICENSE.txt', 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30');
  if (process.platform === 'win32') {
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Expand-Archive -LiteralPath (Join-Path $PWD '.models/whisper-runtime.zip') -DestinationPath (Join-Path $PWD '.models/whisper') -Force"]);
  } else throw new Error('The automatic speech-runtime setup currently targets Windows x64.');
  const previous = JSON.parse(await fs.readFile(path.join(directory, 'downloads.json'), 'utf8').catch(() => '[]'));
  await fs.writeFile(path.join(directory, 'downloads.json'), JSON.stringify([...previous, ...manifest], null, 2));
  console.log('OCR and speech assets ready. Start Ollama with cloud disabled, then run: ollama pull qwen3:4b');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
