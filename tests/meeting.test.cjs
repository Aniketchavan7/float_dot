const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { MeetingService, formatTimestamp } = require('../src/services/meeting');
const { MODES, validateSettings } = require('../src/shared/validation');
const { buildMessages } = require('../src/services/prompts');

test('meeting mode is recognized as valid in MODES and settings', () => {
  assert.ok(MODES.includes('meeting'));
  const valid = validateSettings({ mode: 'meeting' });
  assert.equal(valid.mode, 'meeting');
});

test('meeting prompt enforces citations, decisions vs proposals, and no invented owners', () => {
  const messages = buildMessages({
    mode: 'meeting',
    question: 'What decisions were made?',
    context: { id: 'meeting-1', text: '[00:01:00] Team agreed to use PostgreSQL.', capturedAt: '2026-10-08T00:00:00Z' }
  });
  assert.match(messages[0].content, /Distinguish confirmed Decisions from mere Proposals/i);
  assert.match(messages[0].content, /Never invent owners or deadlines/i);
});

test('formatTimestamp correctly formats elapsed seconds', () => {
  assert.equal(formatTimestamp(0), '00:00');
  assert.equal(formatTimestamp(9), '00:09');
  assert.equal(formatTimestamp(65), '01:05');
  assert.equal(formatTimestamp(3665), '01:01:05');
});

test('MeetingService lifecycle tracks states and manages segments', async () => {
  const emitted = [];
  const fakeSpeech = {
    transcribeSegment: async (wav) => 'We decided to deploy on Friday.'
  };
  const meeting = new MeetingService({
    speech: fakeSpeech,
    infer: async () => 'Summary',
    emit: (event, data) => emitted.push({ event, data })
  });

  assert.equal(meeting.status().state, 'idle');

  const startInfo = meeting.start({ audioSource: 'microphone' });
  assert.equal(meeting.status().state, 'recording');
  assert.ok(startInfo.id);

  assert.equal(meeting.pause(), true);
  assert.equal(meeting.status().state, 'paused');

  assert.equal(meeting.resume(), true);
  assert.equal(meeting.status().state, 'recording');

  // Generate a valid 16kHz mono WAV buffer
  const sampleCount = 16000; // 1 second
  const wavBuffer = Buffer.alloc(44 + sampleCount * 2);
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + sampleCount * 2, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20); // PCM
  wavBuffer.writeUInt16LE(1, 22); // mono
  wavBuffer.writeUInt32LE(16000, 24); // 16kHz
  wavBuffer.writeUInt32LE(32000, 28);
  wavBuffer.writeUInt16LE(2, 32);
  wavBuffer.writeUInt16LE(16, 34);
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(sampleCount * 2, 40);

  const segment = await meeting.addAudioChunk(wavBuffer, 10);
  assert.ok(segment);
  assert.equal(segment.timestamp, '00:10');
  assert.equal(segment.text, 'We decided to deploy on Friday.');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, 'fd:meeting:segment');

  assert.equal(meeting.getTranscriptText(), '[00:10] We decided to deploy on Friday.');

  // Test segment deletion
  assert.equal(meeting.deleteSegment(segment.id), true);
  assert.equal(meeting.getTranscriptText(), '');

  meeting.stop();
  assert.equal(meeting.status().state, 'stopped');

  meeting.clear();
  assert.equal(meeting.status().state, 'idle');
});

test('MeetingService exportMarkdown creates structured notes with metadata and citations', () => {
  const meeting = new MeetingService({
    speech: {},
    infer: async () => '',
    emit: () => {}
  });

  meeting.start({ audioSource: 'microphone' });
  meeting.session.segments.push({
    id: 'seg-1',
    offsetSec: 15,
    timestamp: '00:15',
    text: 'Sarah agreed to test the API.'
  });

  const md = meeting.exportMarkdown('## Key Decisions\n- Use Postgres.');
  assert.match(md, /# Meeting Notes/);
  assert.match(md, /Audio Source:\*\* microphone/);
  assert.match(md, /## Key Decisions/);
  assert.match(md, /\[00:15\] Sarah agreed to test the API\./);
});

test('MeetingService summarize enforces structured sections and timestamped citations', async () => {
  let promptSent = null;
  const meeting = new MeetingService({
    speech: {},
    infer: async ({ messages }) => {
      promptSent = messages;
      return '## Key Decisions\n- Approved release at [00:10].';
    },
    emit: () => {}
  });

  meeting.start();
  meeting.session.segments.push({
    id: 'seg-1',
    offsetSec: 10,
    timestamp: '00:10',
    text: 'Approved release for tomorrow.'
  });

  const summary = await meeting.summarize();
  assert.match(summary, /Approved release at \[00:10\]/);
  assert.match(promptSent[0].content, /Cite timestamp ranges/);
  assert.match(promptSent[0].content, /NEVER invent owners, deadlines/);
  assert.match(promptSent[1].content, /\[00:10\] Approved release for tomorrow\./);
});

async function audioModule() {
  const source = await fs.readFile(path.join(__dirname, '../src/renderer/audio.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('stopping meetings keeps transcript and canceled summaries cannot emit stale output', async () => {
  const events = []; let release;
  const gate = new Promise(resolve => { release = resolve; });
  const meeting = new MeetingService({ speech: {}, emit: (channel, data) => events.push({ channel, data }),
    infer: async ({ onDelta }) => { await gate; onDelta('stale'); return 'stale'; } });
  meeting.start();
  meeting.session.segments.push({ id: 'one', timestamp: '00:00', text: 'Keep this decision.' });
  const summary = meeting.summarize();
  await new Promise(resolve => setImmediate(resolve));
  meeting.cancelSummary(); meeting.stop(); release(); await summary;
  assert.match(meeting.getTranscriptText(), /Keep this decision/);
  assert.equal(events.filter(e => /summary-(delta|done)/.test(e.channel)).length, 0);
});

test('meeting summary drains accepted audio and rejects fabricated source/timestamps', async () => {
  const { encodeWav } = await audioModule();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let messages;
  const meeting = new MeetingService({ speech: { transcribeSegment: async () => { await gate; return 'Approved Friday release.'; } },
    infer: async input => { messages = input.messages; return 'Notes'; } });
  assert.throws(() => meeting.start({ audioSource: 'loopback' }), /microphone/);
  meeting.start();
  const wav = encodeWav([new Float32Array(16000).fill(0.1)], 16000);
  await assert.rejects(meeting.addAudioChunk(wav, Infinity), /timestamp/);
  const chunk = meeting.addAudioChunk(wav, 0);
  meeting.stop();
  const summary = meeting.summarize();
  release(); await chunk; await summary;
  assert.match(messages[1].content, /Approved Friday release/);
});

test('meeting stop releases microphone before transcription finishes and timestamps chunk start', async () => {
  const { MeetingRecorder } = await audioModule();
  let release, stopped = false, offset;
  const gate = new Promise(resolve => { release = resolve; });
  const recorder = new MeetingRecorder({ onChunk: async (wav, at) => { offset = at; await gate; } });
  recorder.active = true; recorder.rate = 16000;
  recorder.startTime = Date.now() - 10000; recorder.chunkStart = recorder.startTime;
  recorder.chunks = [new Float32Array(16000).fill(0.1)];
  recorder.stream = { getTracks: () => [{ stop: () => { stopped = true; } }] };
  const stopping = recorder.stop();
  assert.equal(stopped, true);
  assert.equal(recorder.active, false);
  assert.equal(offset, 0);
  release(); await stopping;
});

test('shortcut and microphone preferences validate and persist supported values', () => {
  assert.deepEqual(validateSettings({ hotkey: 'Ctrl+Alt+F8', microphoneId: 'device-one' }), { hotkey: 'Ctrl+Alt+F8', microphoneId: 'device-one' });
  assert.throws(() => validateSettings({ hotkey: 'bad accelerator' }));
  assert.throws(() => validateSettings({ microphoneId: {} }));
});

test('canceling a summary while queued transcription drains does not start inference', async () => {
  let release, called = false;
  const meeting = new MeetingService({ speech: {}, infer: async () => { called = true; } });
  meeting.start();
  meeting.queue = new Promise(resolve => { release = resolve; });
  const pending = meeting.summarize();
  meeting.cancelSummary(); release();
  await assert.rejects(pending, /canceled/);
  assert.equal(called, false);
});
