const MODES = ['dsa', 'debug', 'general', 'meeting'];
const PROVIDERS = ['ollama', 'openai', 'anthropic', 'gemini', 'compatible'];
function modelName(value) { return text(value, 'Model ID', 200); }
function baseURL(value) {
  const url = new URL(text(value, 'Endpoint', 500));
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Use an HTTPS API base URL, or HTTP on localhost. Do not put keys in the URL.');
  }
  return url.href.replace(/\/$/, '');
}
function text(value, name, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${name} must contain 1–${max} characters.`);
  }
  return value.trim();
}
function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid settings.');
  const result = {};
  if ('provider' in input) {
    if (!PROVIDERS.includes(input.provider)) throw new Error('Unknown AI provider.');
    result.provider = input.provider;
  }
  if ('baseURL' in input) result.baseURL = input.baseURL === '' ? '' : baseURL(input.baseURL);
  if ('hotkey' in input) {
    if (typeof input.hotkey !== 'string' || !/^(?:CommandOrControl|Ctrl|Alt|Shift)(?:\+(?:CommandOrControl|Ctrl|Alt|Shift))*\+(?:Space|[A-Z0-9]|F(?:[1-9]|1[0-2]))$/.test(input.hotkey)) throw new Error('Use a shortcut such as Ctrl+Shift+Space or Ctrl+Alt+F8.');
    result.hotkey = input.hotkey;
  }
  if ('microphoneId' in input) {
    if (typeof input.microphoneId !== 'string' || input.microphoneId.length > 256) throw new Error('Invalid microphone.');
    result.microphoneId = input.microphoneId;
  }
  if ('model' in input) {
    result.model = modelName(input.model);
  }
  if ('mode' in input) {
    if (!MODES.includes(input.mode)) throw new Error('Unknown assistant mode.');
    result.mode = input.mode;
  }
  for (const key of ['confirmCapture', 'readAloud', 'reasoning', 'sendImage']) {
    if (key in input) {
      if (typeof input[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
      result[key] = input[key];
    }
  }
  if ('theme' in input) {
    if (!['system', 'light', 'dark'].includes(input.theme)) throw new Error('Invalid theme.');
    result.theme = input.theme;
  }
  return result;
}
function validateAudio(input) {
  if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) throw new Error('Invalid PCM recording.');
  const buffer = Buffer.from(input instanceof ArrayBuffer ? new Uint8Array(input) : input);
  if (buffer.length < 46 || buffer.length > 960044 || buffer.toString('ascii', 0, 4) !== 'RIFF'
    || buffer.toString('ascii', 8, 12) !== 'WAVE' || buffer.toString('ascii', 12, 16) !== 'fmt '
    || buffer.readUInt32LE(16) !== 16 || buffer.readUInt16LE(20) !== 1
    || buffer.readUInt16LE(22) !== 1 || buffer.readUInt32LE(24) !== 16000
    || buffer.readUInt16LE(34) !== 16 || buffer.readUInt16LE(32) !== 2 || buffer.readUInt32LE(28) !== 32000
    || (buffer.length - 44) % 2 !== 0 || buffer.toString('ascii', 36, 40) !== 'data'
    || buffer.readUInt32LE(40) !== buffer.length - 44 || buffer.readUInt32LE(4) !== buffer.length - 8) {
    throw new Error('Recording must be a maximum 30-second, 16 kHz mono PCM16 WAV.');
  }
  return buffer;
}
function validateCrop(crop, size) {
  if (!crop) return null;
  const { x, y, width, height } = crop;
  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 10 || height < 10
    || x + width > size.width || y + height > size.height) throw new Error('Crop must stay within the selected image.');
  return { x, y, width, height };
}
module.exports = { text, MODES, PROVIDERS, modelName, baseURL, validateSettings, validateAudio, validateCrop };
