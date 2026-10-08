const fs = require('node:fs/promises');
const path = require('node:path');
const { validateSettings } = require('../shared/validation');
const DEFAULTS = Object.freeze({ schemaVersion: 2, provider: 'ollama', baseURL: '', sendImage: false, model: 'qwen3:1.7b', mode: 'dsa', confirmCapture: true, readAloud: false, reasoning: false, theme: 'system', hotkey: 'CommandOrControl+Shift+Space', microphoneId: '' });
async function atomicWrite(targetPath, data) {
  const tmp = `${targetPath}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(tmp, data, { mode: 0o600 });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rename(tmp, targetPath);
      return;
    } catch (err) {
      if ((err.code === 'EPERM' || err.code === 'EBUSY') && attempt < 4) {
        await new Promise(r => setTimeout(r, 20 * (attempt + 1)));
        continue;
      }
      try {
        await fs.copyFile(tmp, targetPath);
        await fs.unlink(tmp).catch(() => {});
        return;
      } catch {
        throw err;
      }
    }
  }
}
class SettingsStore {
  constructor(directory) { this.file = path.join(directory, 'settings.json'); this.value = { ...DEFAULTS }; this.queue = Promise.resolve(); }
  async load() {
    try {
      this.value = { ...DEFAULTS, ...validateSettings(JSON.parse(await fs.readFile(this.file, 'utf8'))) };
      if (this.value.model === 'qwen3:4b') {
        this.value.model = 'qwen3:1.7b';
        await atomicWrite(this.file, JSON.stringify(this.value, null, 2)).catch(() => {});
      }
    }
    catch (error) { if (error.code !== 'ENOENT') this.recovered = true; }
    return this.value;
  }
  update(input) {
    const validated = validateSettings(input);
    const write = this.queue.then(async () => {
      const next = { ...this.value, ...validated };
      await atomicWrite(this.file, JSON.stringify(next, null, 2));
      this.value = next;
      return { ...next };
    });
    this.queue = write.catch(() => {});
    return write;
  }
}
module.exports = { SettingsStore, DEFAULTS };
