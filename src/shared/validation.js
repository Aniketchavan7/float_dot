const MODES = ['dsa', 'debug', 'general', 'meeting'];
const MODEL_PATTERN = /^qwen3:(?:0\.6b|1\.7b|4b|8b)$/;
function text(value, name, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${name} must contain 1–${max} characters.`);
  }
  return value.trim();
}
function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid settings.');
  const result = {};
  if ('model' in input) {
    if (!MODEL_PATTERN.test(input.model)) throw new Error('Choose a supported downloaded Qwen3 model.');
    result.model = input.model;
  }
  if ('mode' in input) {
    if (!MODES.includes(input.mode)) throw new Error('Unknown assistant mode.');
    result.mode = input.mode;
  }
  for (const key of ['confirmCapture', 'readAloud']) {
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
    || buffer.readUInt16LE(34) !== 16 || buffer.toString('ascii', 36, 40) !== 'data'
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
module.exports = { text, MODES, validateSettings, validateAudio, validateCrop };
