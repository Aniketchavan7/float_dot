// Verifies Whisper runtime and audio transcription pipeline
const path = require('node:path');
const os = require('node:os');
const { TranscriptionService, findExecutable } = require('../src/services/transcription');

async function testAudioPipeline() {
  const assetsDir = path.join(__dirname, '../.models');
  const tempDir = path.join(os.tmpdir(), 'floatdot-test-audio');
  const service = new TranscriptionService(assetsDir, tempDir);

  console.log('--- Float Dot Audio & Speech Verification ---');
  const isReady = await service.ready();
  console.log(`Speech service ready: ${isReady}`);

  if (!isReady) {
    console.error('Missing whisper binary or ggml-base.bin. Run: npm run setup:local');
    process.exit(1);
  }

  const exe = await findExecutable(path.join(assetsDir, 'whisper'));
  console.log(`Using Whisper executable: ${exe}`);

  // Generate a 1-second 440Hz sine wave PCM16 mono WAV
  const sampleRate = 16000;
  const numSamples = sampleRate * 1;
  const wav = Buffer.alloc(44 + numSamples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + numSamples * 2, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(i * 2 * Math.PI * 440 / sampleRate) * 0.3;
    wav.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  console.log('Testing segment transcription on synthetic tone (should gracefully detect silence/tone without crashing)...');
  const start = Date.now();
  const segmentResult = await service.transcribeSegment(wav, new AbortController().signal);
  const elapsed = Date.now() - start;

  console.log(`Segment transcription completed in ${elapsed}ms. Result: "${segmentResult || '(silent/skipped)'}"`);
  console.log('Audio pipeline verification PASSED.');
}

testAudioPipeline().catch(err => {
  console.error('Audio verification failed:', err);
  process.exit(1);
});
