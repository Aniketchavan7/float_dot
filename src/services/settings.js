const fs = require('node:fs/promises');
const path = require('node:path');
const { validateSettings } = require('../shared/validation');
const DEFAULTS = Object.freeze({ schemaVersion: 2, provider: 'ollama', baseURL: '', sendImage: false, model: 'qwen3:4b', mode: 'general', confirmCapture: true, readAloud: false, reasoning: false, theme: 'system', hotkey: 'CommandOrControl+Shift+Space', microphoneId: '' });
class SettingsStore {
  constructor(directory) { this.file = path.join(directory, 'settings.json'); this.value = { ...DEFAULTS }; this.queue = Promise.resolve(); }
  async load() {
    try { this.value = { ...DEFAULTS, ...validateSettings(JSON.parse(await fs.readFile(this.file, 'utf8'))) }; }
    catch (error) { if (error.code !== 'ENOENT') this.recovered = true; }
    return this.value;
  }
  update(input) {
    const validated = validateSettings(input);
    const write = this.queue.then(async () => {
    const next = { ...this.value, ...validated };
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(`${this.file}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 });
    await fs.rename(`${this.file}.tmp`, this.file);
    this.value = next;
    return { ...next };
    });
    this.queue = write.catch(() => {});
    return write;
  }
}
module.exports = { SettingsStore, DEFAULTS };
