import { Recorder, MeetingRecorder } from './audio.js';
const api = window.floatDot;
const $ = id => document.getElementById(id);
let mode = 'dsa', context = null, answer = '', activeRequest = null, epoch = 0, busy = false, micStarting = false;
let meetingActive = false, meetingPaused = false, meetingTimer = null, meetingStartEpoch = 0, meetingRequest = null;
let preferences = { confirmCapture: true, readAloud: false, theme: 'system', model: 'qwen3:4b' };
const providerLabels = { ollama: 'Ollama · local', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini', compatible: 'Custom API' };
function providerDescription() { return `${providerLabels[preferences.provider]} · ${preferences.model}`; }
function providerFields() {
  const choice = $('provider').value;
  $('endpoint-field').hidden = choice !== 'compatible'; $('key-field').hidden = choice === 'ollama';
}
const recorder = new Recorder(() => guarded(record));
const meetingRecorder = new MeetingRecorder({
  onChunk: async (wav, offsetSec) => {
    try { await call('meetingChunk', { audio: wav, offsetSec }); }
    catch (e) { error(e.message); }
  },
  intervalMs: 10000
});
async function call(method, input) {
  const result = await api[method](input);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
function state(label, kind = 'idle') { $('status-text').textContent = label; document.body.dataset.state = kind; }
function error(message) { $('error').textContent = message; $('error').hidden = false; state('Needs a little attention', 'error'); }
function resetError() { $('error').hidden = true; }
function renderAnswer() {
  const html = window.marked.parse(answer, { breaks: true });
  $('answer').innerHTML = window.DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'pre', 'code', 'h1', 'h2', 'h3', 'blockquote', 'hr'], ALLOWED_ATTR: ['class'] });
  window.Prism?.highlightAllUnder($('answer'));
}
function lock(value) {
  busy = value; $('capture').disabled = value; $('record').disabled = value;
  $('confirm').disabled = value; $('follow-up').disabled = value;
  $('source').disabled = value; $('refresh-windows').disabled = value;
  $('stop').hidden = !value;
  $('answer-stop').hidden = !value;
  $('meeting-summarize').disabled = value;
  $('meeting-record').disabled = value || meetingActive;
  $('crop-capture').disabled = value;
  $('open-screenshot').disabled = value;
  $('paste-screenshot').disabled = value;
}
function stopped() {
  recorder.cancel(); micStarting = false; $('record-label').textContent = 'Ask with voice';
  $('record').disabled = false; $('capture').disabled = false; $('stop').hidden = true;
}
async function guarded(action) { try { resetError(); await action(); } catch (e) { lock(false); stopped(); error(e.message); } }
async function refreshStatus() {
  const status = await call('status'); preferences = status.settings; mode = preferences.mode;
  $('provider').value = preferences.provider; $('endpoint').value = preferences.baseURL; $('send-image').checked = preferences.sendImage; providerFields();
  $('key-status').textContent = status.keySaved ? 'A key is saved with OS encryption. It is never shown here.' : 'No saved key. A key is optional for some custom endpoints.';
  const destination = preferences.provider === 'ollama' ? 'Only the local Ollama server receives your question and capture.' : `Your question and ${preferences.sendImage ? 'screenshot image' : 'extracted screen text'} are sent to ${preferences.provider === 'compatible' ? preferences.baseURL || 'your configured endpoint' : providerLabels[preferences.provider]}. Your provider may charge for usage.`;
  $('provider-notice').textContent = destination; $('processing-location').textContent = providerDescription();
  $('reasoning').checked = preferences.reasoning;
  $('hotkey').value = preferences.hotkey; $('shortcut-label').textContent = preferences.hotkey;
  $('microphone').replaceChildren(new Option('System default', ''));
  const microphones = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput');
  microphones.forEach((device, index) => $('microphone').add(new Option(device.label || `Microphone ${index + 1}`, device.deviceId)));
  if (preferences.microphoneId && !microphones.some(device => device.deviceId === preferences.microphoneId)) $('microphone').add(new Option('Previously selected microphone (unavailable)', preferences.microphoneId));
  $('microphone').value = preferences.microphoneId;
  setModeButtons(); setTheme(); $('confirm-capture').checked = preferences.confirmCapture; $('read-aloud').checked = preferences.readAloud; $('theme').value = preferences.theme;
  $('model-options').replaceChildren();
  const available = [...new Set([preferences.model, ...status.models.map(m => m.name)])];
  for (const name of available) $('model-options').append(new Option(name, name));
  $('model').value = preferences.model;
  $('readiness').replaceChildren();
  const providerReady = preferences.provider === 'ollama' ? status.models.some(m => m.name === preferences.model) : preferences.provider === 'compatible' ? !!preferences.baseURL : status.keySaved;
  const rows = [[providerLabels[preferences.provider], providerReady], [preferences.sendImage ? 'Screenshot image mode' : 'Screen text', preferences.sendImage || status.ocrReady], ['Voice recognition (optional)', status.speechReady]];
  for (const [label, ready] of rows) { const row = document.createElement('div'); row.className = 'readiness-row' + (ready ? '' : ' missing');
    const left = document.createElement('span'), right = document.createElement('span'); left.textContent = label; right.textContent = ready ? 'Ready' : 'Setup needed'; row.append(left, right); $('readiness').append(row); }
  const ready = rows.slice(0, 2).every(([, value]) => value); $('setup').hidden = ready;
  state(ready ? 'Choose a source or open a screenshot' : 'Choose your AI provider and finish setup');
  if (status.modelError) error(status.modelError);
  if (status.shortcutError) error(status.shortcutError);
}
function setTheme() { if (preferences.theme === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = preferences.theme; }
function setModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  const isMeeting = mode === 'meeting';
  if ($('window-inputs')) $('window-inputs').hidden = isMeeting;
  if ($('meeting-inputs')) $('meeting-inputs').hidden = !isMeeting;
  const sourceHeading = $('source')?.closest('.section-heading');
  if (sourceHeading) sourceHeading.hidden = isMeeting;
  if ($('source')) $('source').hidden = isMeeting;
}
async function refreshWindows() {
  const previous = $('source').value, windows = await call('windows');
  $('source').replaceChildren(new Option('Choose a window or display…', ''));
  windows.forEach(win => $('source').add(new Option(win.name, win.id)));
  if (windows.some(win => win.id === previous)) $('source').value = previous;
}
async function prepare(audio, crop, openScreenshot = false) {
  if (!openScreenshot && !$('source').value) throw new Error('Choose a window or display before asking.');
  const version = ++epoch; lock(true); state(audio ? 'Transcribing your question and reading the window…' : 'Reading the selected window…', 'busy');
  context = null; $('answer-section').hidden = true; $('capture-review').hidden = true; $('empty').hidden = true;
  let captured;
  try { captured = await call('prepare', { sourceId: $('source').value, question: $('question').value, audio, crop, openScreenshot }); }
  catch (e) { if (version !== epoch) return; throw e; }
  if (version !== epoch) return;
  if (!captured) { lock(false); $('empty').hidden = false; state('No screenshot selected'); return; }
  context = captured; $('question').value = captured.transcript; $('preview').src = captured.preview;
  $('capture-meta').textContent = `${captured.name} · ${new Date(captured.capturedAt).toLocaleTimeString()} · ${captured.dimensions.width}×${captured.dimensions.height}`;
  $('extracted').textContent = captured.text;
  $('crop-capture').closest('details').hidden = openScreenshot;
  $('crop-x').value = 0; $('crop-y').value = 0;
  $('crop-width').value = captured.dimensions.width; $('crop-height').value = captured.dimensions.height;
  $('ocr-warning').hidden = captured.confidence >= 75 && !captured.truncated;
  $('ocr-warning').textContent = 'Check the extracted text before proceeding. Small text/operators may be misread' + (captured.truncated ? '; only the first part is included.' : '.');
  $('capture-review').hidden = false; lock(false); state(`Capture ready · ${providerDescription()}`);
  $('confirm').textContent = `Explain with ${providerLabels[preferences.provider]}`;
  if (!preferences.confirmCapture) await ask();
}
async function ask() {
  if (!context) throw new Error('Read a window first.');
  if (!$('question').value.trim()) throw new Error('Add a question first.');
  lock(true); answer = ''; activeRequest = null; renderAnswer();
  $('answer-section').hidden = false; $('capture-review').hidden = true; $('empty').hidden = true;
  $('answer-meta').textContent = `${providerDescription()} · ${context.name} · ${new Date(context.capturedAt).toLocaleTimeString()}`;
  state(`Asking ${providerDescription()}…`, 'busy');
  await call('ask', { question: $('question').value, mode, contextId: context.id });
}
async function record() {
  if (busy) return;
  if (recorder.active) {
    state('Finishing recording…', 'busy'); const wav = await recorder.stop(); stopped();
    if (context && answer && $('reuse-capture').checked) {
      const version = ++epoch; lock(true); state('Transcribing follow-up · keeping current capture…', 'busy');
      let transcript;
      try { transcript = await call('transcribe', wav); } catch (e) { if (version !== epoch) return; throw e; }
      if (version !== epoch) return;
      $('question').value = transcript;
      if (/\b(read|capture|look at)\b.*\b(screen|window|display)\b|\b(recapture|new screenshot)\b/i.test(transcript)) await prepare();
      else await ask();
    } else await prepare(wav);
    return;
  }
  if (micStarting) return;
  if (!$('source').value && !(context && answer && $('reuse-capture').checked)) throw new Error('Choose a window or display before recording.');
  window.speechSynthesis?.cancel(); micStarting = true; $('record').disabled = true;
  await recorder.start(preferences.microphoneId); micStarting = false;
  if (!recorder.active) { stopped(); return; }
  state('Listening · click again to stop (30-second limit)', 'recording');
  $('record-label').textContent = 'Finish recording'; $('record').disabled = false; $('capture').disabled = true; $('stop').hidden = false;
}
async function stop() { ++epoch; activeRequest = null; meetingRequest = null; await stopMeeting(); lock(false); stopped(); window.speechSynthesis?.cancel(); await call('cancel'); state('Stopped · ready when you are'); }
async function clear() { await stop(); await call('clear'); context = null; answer = ''; $('meeting-transcript-list').replaceChildren(); $('meeting-transcript-section').hidden = true; $('answer-section').hidden = true; $('capture-review').hidden = true; $('empty').hidden = false; }
function readAloud() {
  if (recorder.active || meetingActive || micStarting) throw new Error('Stop recording before reading an answer aloud.');
  if (!answer) return;
  const voice = window.speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith('en'));
  if (!voice) throw new Error('No installed local English voice is available. Text answers still work.');
  window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance($('answer').textContent); utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
function updateMeetingTimer() {
  if (!meetingActive || meetingPaused) return;
  const elapsed = Math.floor((Date.now() - meetingStartEpoch) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  if ($('meeting-timer')) $('meeting-timer').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
async function startMeeting() {
  if (meetingActive || busy) return;
  await stop();
  meetingActive = true;
  meetingPaused = false;
  meetingStartEpoch = Date.now();
  $('meeting-record-label').textContent = 'Recording Meeting…';
  $('meeting-record').disabled = true;
  $('meeting-pause').hidden = false;
  $('meeting-pause').textContent = 'Pause';
  $('meeting-stop').hidden = false;
  $('meeting-transcript-section').hidden = false;
  state('Meeting recording started · speaking into room microphone', 'recording');
  clearInterval(meetingTimer);
  meetingTimer = setInterval(updateMeetingTimer, 1000);
  $('meeting-transcript-list').replaceChildren();
  answer = ''; renderAnswer();
  try {
    await call('meetingStart');
    await meetingRecorder.start(preferences.microphoneId);
  } catch (e) {
    meetingRecorder.cancel(); meetingActive = false; meetingPaused = false;
    clearInterval(meetingTimer);
    $('meeting-record-label').textContent = 'Start Meeting'; $('meeting-record').disabled = false;
    $('meeting-pause').hidden = true; $('meeting-stop').hidden = true;
    await call('meetingStop');
    throw e;
  }
}
async function pauseMeeting() {
  if (!meetingActive) return;
  if (!meetingPaused) {
    meetingPaused = true;
    await meetingRecorder.pause();
    await call('meetingPause');
    $('meeting-pause').textContent = 'Resume';
    state('Meeting recording paused', 'idle');
  } else {
    meetingPaused = false;
    meetingRecorder.resume();
    await call('meetingResume');
    $('meeting-pause').textContent = 'Pause';
    state('Meeting recording resumed', 'recording');
  }
}
async function stopMeeting() {
  if (!meetingActive) return;
  meetingActive = false;
  meetingPaused = false;
  clearInterval(meetingTimer);
  await meetingRecorder.stop();
  await call('meetingStop');
  $('meeting-record-label').textContent = 'Start Meeting';
  $('meeting-record').disabled = false;
  $('meeting-pause').hidden = true;
  $('meeting-stop').hidden = true;
  state('Meeting recording stopped · review transcript or summarize', 'idle');
}
async function clearMeeting() {
  meetingRequest = null;
  await stopMeeting();
  await call('meetingClear');
  $('meeting-transcript-list').replaceChildren();
  answer = ''; renderAnswer(); $('answer-section').hidden = true;
  $('meeting-transcript-section').hidden = true;
  state('Meeting session cleared');
}
async function summarizeMeeting() {
  await stopMeeting();
  const version = ++epoch;
  meetingRequest = null;
  lock(true);
  answer = '';
  renderAnswer();
  $('answer-section').hidden = false;
  $('empty').hidden = true;
  $('answer-meta').textContent = `Meeting Summary · ${new Date().toLocaleTimeString()}`;
  state('Extracting decisions and action items…', 'busy');
  try { await call('meetingSummarize'); }
  catch (e) { if (version === epoch) throw e; }
}
async function exportMeeting() {
  const saved = await call('meetingExport', { summary: answer });
  if (saved) state('Meeting notes exported successfully');
}
function on(id, action) { $(id).addEventListener('click', () => guarded(action)); }
if (location.hash === '#dot') {
  document.body.classList.add('dot-view');
  $('floating-dot').addEventListener('click', () => call('expand').catch(() => {}));
} else {
  on('record', record); on('stop', stop); on('capture', () => prepare()); on('confirm', ask);
  on('open-screenshot', () => prepare(undefined, undefined, true));
  on('paste-screenshot', () => prepare(undefined, undefined, 'clipboard'));
  $('provider').addEventListener('change', () => { providerFields(); $('model').value = ''; $('api-key').value = ''; $('key-status').textContent = 'Save the provider and model to switch.'; });
  on('save-provider', async () => {
    await stop();
    const key = $('api-key').value; $('api-key').value = '';
    preferences = await call('settings', { provider: $('provider').value, model: $('model').value.trim(), baseURL: $('provider').value === 'compatible' ? $('endpoint').value.trim() : '', sendImage: $('send-image').checked });
    if (key && preferences.provider !== 'ollama') await call('credentials', { key });
    await refreshStatus(); state(`Provider saved · ${providerDescription()}`);
  });
  on('remove-key', async () => { if ($('provider').value !== preferences.provider) throw new Error('Save the provider selection first.'); await call('credentials', { key: '' }); await refreshStatus(); });
  on('answer-stop', stop);
  on('crop-capture', () => prepare(undefined, Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number($('crop-' + key).value)]))));
  on('refresh-windows', refreshWindows); on('refresh-status', refreshStatus);
  on('save-hotkey', async () => { await stop(); preferences = await call('settings', { hotkey: $('hotkey').value.trim() }); $('shortcut-label').textContent = preferences.hotkey; state('Shortcut saved'); });
  $('microphone').addEventListener('change', () => guarded(async () => { await stop(); preferences = await call('settings', { microphoneId: $('microphone').value }); }));
  on('collapse', async () => { await stop(); await call('collapse'); }); on('clear', clear); on('discard', clear);
  on('copy', async () => { await call('copy', answer); state('Answer copied'); });
  on('export', () => call('export', `# Float Dot note\n\nSource: ${context?.name}\nCaptured: ${context?.capturedAt}\n\n${answer}`));
  on('speak', readAloud); on('follow-up', ask);
  on('settings-toggle', () => { $('setup').hidden = !$('setup').hidden; });
  on('meeting-record', startMeeting); on('meeting-pause', pauseMeeting); on('meeting-stop', stopMeeting);
  on('meeting-clear', clearMeeting); on('meeting-summarize', summarizeMeeting); on('meeting-export', exportMeeting);
  $('source').addEventListener('change', () => guarded(clear));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => guarded(async () => {
    await stop(); context = null; answer = ''; renderAnswer(); $('answer-section').hidden = true; $('capture-review').hidden = true;
    mode = button.dataset.mode; preferences = await call('settings', { mode }); setModeButtons();
  })));
  for (const [id, key] of [['confirm-capture', 'confirmCapture'], ['read-aloud', 'readAloud'], ['reasoning', 'reasoning'], ['theme', 'theme']]) {
    $(id).addEventListener('change', () => guarded(async () => {
      await stop(); preferences = await call('settings', { [key]: $(id).type === 'checkbox' ? $(id).checked : $(id).value }); setTheme();
    }));
  }
  api.onHotkey(() => guarded(mode === 'meeting' ? (meetingActive ? stopMeeting : startMeeting) : record));
  api.onCancel(() => {
    recorder.cancel(); meetingRecorder.cancel(); meetingActive = false; meetingPaused = false; clearInterval(meetingTimer);
    $('meeting-record-label').textContent = 'Start Meeting'; $('meeting-record').disabled = false;
    $('meeting-pause').hidden = true; $('meeting-stop').hidden = true;
    micStarting = false; $('record-label').textContent = 'Ask with voice'; if (!busy) stopped();
  });
  api.onAnswer(event => {
    if (event.type === 'started') { activeRequest = event.requestId; return; }
    if (event.requestId !== activeRequest) return;
    if (event.type === 'delta') { answer += event.delta; renderAnswer(); state(`Answering · ${providerDescription()}`, 'busy'); }
    if (event.type === 'done') { lock(false); state('Ready · ask a follow-up or read a new screen'); if (preferences.readAloud) guarded(readAloud); }
    if (event.type === 'error') { lock(false); error(event.message); }
    if (event.type === 'canceled') { lock(false); state('Answer stopped'); }
  });
  api.onMeetingSegment(segment => {
    const row = document.createElement('div');
    row.className = 'meeting-segment';
    const time = document.createElement('span');
    time.className = 'segment-time';
    time.textContent = `[${segment.timestamp}]`;
    const txt = document.createElement('span');
    txt.className = 'segment-text';
    txt.textContent = segment.text;
    const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = 'Delete';
    remove.addEventListener('click', () => guarded(async () => {
      await call('meetingDeleteSegment', { id: segment.id }); row.remove();
      meetingRequest = null; answer = ''; renderAnswer();
    }));
    row.append(time, txt, remove);
    $('meeting-transcript-list').append(row);
    $('meeting-transcript-list').scrollTop = $('meeting-transcript-list').scrollHeight;
  });
  api.onMeetingError(event => error(event.message));
  api.onMeetingSummaryStart(event => { meetingRequest = event.requestId; });
  api.onMeetingSummaryDelta(event => {
    if (event.requestId !== meetingRequest) return;
    answer += event.delta;
    renderAnswer();
    state('Generating meeting summary…', 'busy');
  });
  api.onMeetingSummaryDone(event => {
    if (event.requestId !== meetingRequest) return;
    lock(false);
    state('Meeting summary complete · decisions and action items ready');
  });
  api.onMeetingSummaryError(event => {
    if (event.requestId !== meetingRequest) return;
    lock(false);
    error(event.message);
  });
  window.addEventListener('beforeunload', () => { recorder.cancel(); meetingRecorder.cancel(); window.speechSynthesis?.cancel(); });
  guarded(async () => { await refreshStatus(); await refreshWindows(); });
}
