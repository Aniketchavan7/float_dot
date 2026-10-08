const fs = require('node:fs');
const path = require('node:path');
const { createWorker, PSM } = require('tesseract.js');
class OcrService {
  constructor(modelDirectory) { this.directory = modelDirectory; }
  ready() { return fs.existsSync(path.join(this.directory, 'eng.traineddata')); }
  async read(buffer, signal) {
    if (!this.ready()) throw new Error('English OCR data is missing. Run npm run setup:local first.');
    let worker = null;
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = reject; });
    // Guard against an abort rejection while the worker is still initializing.
    aborted.catch(() => {});
    const stop = () => { worker?.terminate().catch(() => {}); rejectAbort(new Error('Screen reading canceled.')); };
    signal.addEventListener('abort', stop, { once: true });
    try {
      signal.throwIfAborted();
      const creating = createWorker('eng', 1, { langPath: this.directory, gzip: false, cacheMethod: 'none',
        errorHandler: () => {} });
      creating.then(value => { if (signal.aborted) value.terminate().catch(() => {}); }).catch(() => {});
      worker = await Promise.race([creating, aborted]);
      signal.throwIfAborted();
      await Promise.race([worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' }), aborted]);
      const result = await Promise.race([worker.recognize(buffer), aborted]);
      signal.throwIfAborted();
      if (!result.data.text.trim()) throw new Error('No readable text found. Choose a clearer window or crop.');
      return { text: result.data.text.slice(0, 12000), confidence: result.data.confidence,
        truncated: result.data.text.length > 12000 };
    } finally {
      signal.removeEventListener('abort', stop);
      if (worker) await worker.terminate().catch(() => {});
    }
  }
}
module.exports = { OcrService };
