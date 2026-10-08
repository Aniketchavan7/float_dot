const fs = require('node:fs/promises');
const path = require('node:path');
const { PROVIDERS, baseURL, text } = require('../shared/validation');
function identity(config) {
  if (!PROVIDERS.includes(config.provider) || config.provider === 'ollama') throw new Error('Choose an API provider.');
  return config.provider === 'compatible' ? `compatible:${baseURL(config.baseURL)}` : config.provider;
}
class CredentialStore {
  constructor(directory, encryption) { this.file = path.join(directory, 'credentials.json'); this.encryption = encryption; this.values = {}; this.queue = Promise.resolve(); }
  async load() {
    try { this.values = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('Stored API keys could not be loaded.'); }
  }
  get(config) {
    if (config.provider === 'ollama') return '';
    const value = this.values[identity(config)];
    if (!value) return '';
    try { return this.encryption.decryptString(Buffer.from(value, 'base64')); }
    catch { throw new Error('API key could not be unlocked. Save it again in AI settings.'); }
  }
  set(config, key) {
    const id = identity(config);
    if (key !== '') text(key, 'API key', 4096);
    if (key && !this.encryption.isEncryptionAvailable()) throw new Error('OS key encryption is unavailable. No key was saved.');
    const encrypted = key ? this.encryption.encryptString(key.trim()).toString('base64') : null;
    const task = this.queue.then(async () => {
      const next = { ...this.values }; if (encrypted) next[id] = encrypted; else delete next[id];
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file + '.tmp', JSON.stringify(next), { mode: 0o600 });
      await fs.rename(this.file + '.tmp', this.file); this.values = next;
    });
    this.queue = task.catch(() => {}); return task;
  }
}
module.exports = { CredentialStore, identity };
