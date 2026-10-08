export function encodeWav(chunks, inputRate) {
  const size = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const input = new Float32Array(size);
  let offset = 0; for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.length; }
  const count = Math.min(480000, Math.floor(input.length * 16000 / inputRate));
  const output = new ArrayBuffer(44 + count * 2); const view = new DataView(output);
  const ascii = (at, value) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * inputRate / 16000), end = Math.max(start + 1, Math.floor((i + 1) * inputRate / 16000));
    let sample = 0; for (let j = start; j < Math.min(end, input.length); j++) sample += input[j];
    sample = Math.max(-1, Math.min(1, sample / (Math.min(end, input.length) - start)));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Uint8Array(output);
}
export class Recorder {
  constructor(onLimit) { this.onLimit = onLimit; this.active = false; this.generation = 0; }
  async start() {
    const generation = ++this.generation;
    this.chunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    try {
      this.context = new AudioContext(); this.rate = this.context.sampleRate;
      await this.context.audioWorklet.addModule('floatdot://app/audio-worklet.js');
      if (generation !== this.generation) { this.cancel(); return; }
      this.node = new AudioWorkletNode(this.context, 'float-dot-recording');
      this.node.port.onmessage = event => { if (this.active) this.chunks.push(event.data); };
      this.source = this.context.createMediaStreamSource(stream);
      this.gain = this.context.createGain(); this.gain.gain.value = 0;
      this.source.connect(this.node); this.node.connect(this.gain); this.gain.connect(this.context.destination);
      await this.context.resume(); this.active = true;
      this.timer = setTimeout(() => this.onLimit(), 30000);
    } catch (error) { this.cancel(); throw error; }
  }
  async stop() {
    const chunks = this.chunks || [], rate = this.rate;
    this.cancel();
    if (!chunks.length) throw new Error('No microphone audio recorded. Try again.');
    let energy = 0, samples = 0;
    for (const chunk of chunks) for (const value of chunk) { energy += value * value; samples++; }
    if (samples < rate / 4 || Math.sqrt(energy / samples) < 0.001) throw new Error('No clear audio detected. Check your microphone and speak again.');
    return encodeWav(chunks, rate);
  }
  cancel() {
    ++this.generation; this.active = false; clearTimeout(this.timer);
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.source?.disconnect(); this.node?.disconnect(); this.gain?.disconnect();
    if (this.node) this.node.port.onmessage = null;
    this.context?.close().catch(() => {}); this.context = null;
    this.chunks = [];
  }
}

export class MeetingRecorder {
  constructor({ onChunk, intervalMs = 10000 }) {
    this.onChunk = onChunk;
    this.intervalMs = intervalMs;
    this.active = false;
    this.paused = false;
    this.generation = 0;
    this.startTime = 0;
  }
  async start() {
    const generation = ++this.generation;
    this.chunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      video: false
    });
    if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    try {
      this.context = new AudioContext();
      this.rate = this.context.sampleRate;
      await this.context.audioWorklet.addModule('floatdot://app/audio-worklet.js');
      if (generation !== this.generation) { this.cancel(); return; }
      this.node = new AudioWorkletNode(this.context, 'float-dot-recording');
      this.node.port.onmessage = event => {
        if (this.active && !this.paused) this.chunks.push(event.data);
      };
      this.source = this.context.createMediaStreamSource(stream);
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.source.connect(this.node);
      this.node.connect(this.gain);
      this.gain.connect(this.context.destination);
      await this.context.resume();
      this.active = true;
      this.paused = false;
      this.startTime = Date.now();
      this._scheduleNextFlush();
    } catch (err) { this.cancel(); throw err; }
  }
  _scheduleNextFlush() {
    clearTimeout(this.intervalTimer);
    if (!this.active) return;
    this.intervalTimer = setTimeout(async () => {
      if (this.active && !this.paused) await this.flushChunk();
      this._scheduleNextFlush();
    }, this.intervalMs);
  }
  async flushChunk() {
    const slice = this.chunks || [];
    this.chunks = [];
    if (!slice.length) return;
    let energy = 0, samples = 0;
    for (const chunk of slice) for (const value of chunk) { energy += value * value; samples++; }
    if (samples < this.rate / 4 || Math.sqrt(energy / samples) < 0.0005) return;
    const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
    const wav = encodeWav(slice, this.rate);
    try { await this.onChunk(wav, elapsedSec); }
    catch (err) { console.warn('Chunk processing error:', err); }
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  async stop() {
    this.active = false;
    clearTimeout(this.intervalTimer);
    await this.flushChunk();
    this.cancel();
  }
  cancel() {
    ++this.generation;
    this.active = false;
    this.paused = false;
    clearTimeout(this.intervalTimer);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.source?.disconnect();
    this.node?.disconnect();
    this.gain?.disconnect();
    if (this.node) this.node.port.onmessage = null;
    this.context?.close().catch(() => {});
    this.context = null;
    this.chunks = [];
  }
}
