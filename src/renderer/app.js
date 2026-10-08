import { Recorder, MeetingRecorder } from './audio.js';
const api = window.floatDot;
const $ = id => document.getElementById(id);
let mode = 'dsa', context = null, answer = '', activeRequest = null, epoch = 0, busy = false, micStarting = false;
let meetingActive = false, meetingPaused = false, meetingTimer = null, meetingStartEpoch = 0;
let preferences = { confirmCapture: true, readAloud: false, theme: 'system', model: 'qwen3:4b' };
const recorder = new Recorder(() => guarded(record));
const meetingRecorder = new MeetingRecorder({
  onChunk: async (wav, offsetSec) => {
    try { await call('meetingChunk', { audio: wav, offsetSec }); }
    catch (e) { console.warn('Chunk processing error:', e); }
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
}
function stopped() {
  recorder.cancel(); micStarting = false; $('record-label').textContent = 'Ask with voice';
  $('record').disabled = false; $('capture').disabled = false; $('stop').hidden = true;
}
async function guarded(action) { try { resetError(); await action(); } catch (e) { lock(false); stopped(); error(e.message); } }
async function refreshStatus() {
  const status = await call('status'); preferences = status.settings; mode = preferences.mode;
  setModeButtons(); setTheme(); $('confirm-capture').checked = preferences.confirmCapture; $('read-aloud').checked = preferences.readAloud; $('theme').value = preferences.theme;
  $('model').replaceChildren();
  const available = [...new Set([preferences.model, ...status.models.map(m => m.name)])];
  for (const name of available) $('model').add(new Option(name + (status.models.some(m => m.name === name) ? ' · downloaded' : ' · missing'), name));
  $('model').value = preferences.model;
  $('readiness').replaceChildren();
  const rows = [['Local AI', status.models.some(m => m.name === preferences.model)], ['Screen text', status.ocrReady], ['Voice recognition', status.speechReady]];
  for (const [label, ready] of rows) { const row = document.createElement('div'); row.className = 'readiness-row' + (ready ? '' : ' missing');
    const left = document.createElement('span'), right = document.createElement('span'); left.textContent = label; right.textContent = ready ? 'Ready' : 'Setup needed'; row.append(left, right); $('readiness').append(row); }
  const ready = rows.every(([, value]) => value); $('setup').hidden = ready;
  state(ready ? 'Local components ready · choose a window' : 'Finish local setup to ask your screen');
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
  $('source').replaceChildren(new Option('Choose a window…', ''));
  windows.forEach(win => $('source').add(new Option(win.name, win.id)));
  if (windows.some(win => win.id === previous)) $('source').value = previous;
}
async function prepare(audio) {
  if (!$('source').value) throw new Error('Choose a window before asking.');
  if (!audio && !$('question').value.trim()) throw new Error('Speak or type a question first.');
  const version = ++epoch; lock(true); state(audio ? 'Transcribing your question and reading the window…' : 'Reading the selected window…', 'busy');
  context = null; $('answer-section').hidden = true; $('capture-review').hidden = true; $('empty').hidden = true;
  let captured;
  try { captured = await call('prepare', { sourceId: $('source').value, question: $('question').value, audio }); }
  catch (e) { if (version !== epoch) return; throw e; }
  if (version !== epoch) return;
  context = captured; $('question').value = captured.transcript; $('preview').src = captured.preview;
  $('capture-meta').textContent = `${captured.name} · ${new Date(captured.capturedAt).toLocaleTimeString()} · ${captured.dimensions.width}×${captured.dimensions.height}`;
  $('extracted').textContent = captured.text;
  $('ocr-warning').hidden = captured.confidence >= 75 && !captured.truncated;
  $('ocr-warning').textContent = 'Check the extracted text before proceeding. Small text/operators may be misread' + (captured.truncated ? '; only the first part is included.' : '.');
  $('capture-review').hidden = false; lock(false); state('Capture ready · review your question and context');
  if (!preferences.confirmCapture) await ask();
}
async function ask() {
  if (!context) throw new Error('Read a window first.');
  if (!$('question').value.trim()) throw new Error('Add a question first.');
  lock(true); answer = ''; activeRequest = null; renderAnswer();
  $('answer-section').hidden = false; $('capture-review').hidden = true; $('empty').hidden = true;
  $('answer-meta').textContent = `Using ${context.name} · capture from ${new Date(context.capturedAt).toLocaleTimeString()}`;
  state('Thinking locally…', 'busy');
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
      $('question').value = transcript; await ask();
    } else await prepare(wav);
    return;
  }
  if (micStarting) return;
  if (!$('source').value) throw new Error('Choose a window before recording.');
  window.speechSynthesis?.cancel(); micStarting = true; $('record').disabled = true;
  await recorder.start(); micStarting = false;
  if (!recorder.active) { stopped(); return; }
  state('Listening · click again to stop (30-second limit)', 'recording');
  $('record-label').textContent = 'Finish recording'; $('record').disabled = false; $('capture').disabled = true; $('stop').hidden = false;
}
async function stop() { ++epoch; activeRequest = null; lock(false); stopped(); window.speechSynthesis?.cancel(); await call('cancel'); state('Stopped · ready when you are'); }
async function clear() { await stop(); await call('clear'); context = null; answer = ''; $('answer-section').hidden = true; $('capture-review').hidden = true; $('empty').hidden = false; }
function readAloud() {
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
  if (meetingActive) return;
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
  await call('meetingStart');
  await meetingRecorder.start();
}
async function pauseMeeting() {
  if (!meetingActive) return;
  if (!meetingPaused) {
    meetingPaused = true;
    meetingRecorder.pause();
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
  await stopMeeting();
  await call('meetingClear');
  $('meeting-transcript-list').replaceChildren();
  $('meeting-transcript-section').hidden = true;
  state('Meeting session cleared');
}
async function summarizeMeeting() {
  lock(true);
  answer = '';
  renderAnswer();
  $('answer-section').hidden = false;
  $('empty').hidden = true;
  $('answer-meta').textContent = `Meeting Summary · ${new Date().toLocaleTimeString()}`;
  state('Extracting decisions and action items locally…', 'busy');
  await call('meetingSummarize');
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
  on('refresh-windows', refreshWindows); on('refresh-status', refreshStatus);
  on('collapse', async () => { await stop(); await call('collapse'); }); on('clear', clear); on('discard', clear);
  on('copy', async () => { await call('copy', answer); state('Answer copied'); });
  on('export', () => call('export', `# Float Dot note\n\nSource: ${context?.name}\nCaptured: ${context?.capturedAt}\n\n${answer}`));
  on('speak', readAloud); on('follow-up', ask);
  on('settings-toggle', () => { $('setup').hidden = !$('setup').hidden; });
  on('meeting-record', startMeeting); on('meeting-pause', pauseMeeting); on('meeting-stop', stopMeeting);
  on('meeting-clear', clearMeeting); on('meeting-summarize', summarizeMeeting); on('meeting-export', exportMeeting);
  $('source').addEventListener('change', () => guarded(clear));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => guarded(async () => {
    await stop(); mode = button.dataset.mode; preferences = await call('settings', { mode }); setModeButtons();
  })));
  for (const [id, key] of [['model', 'model'], ['confirm-capture', 'confirmCapture'], ['read-aloud', 'readAloud'], ['theme', 'theme']]) {
    $(id).addEventListener('change', () => guarded(async () => {
      await stop(); preferences = await call('settings', { [key]: $(id).type === 'checkbox' ? $(id).checked : $(id).value }); setTheme();
    }));
  }
  api.onHotkey(() => guarded(record));
  api.onCancel(() => { recorder.cancel(); micStarting = false; $('record-label').textContent = 'Ask with voice'; if (!busy) stopped(); });
  api.onAnswer(event => {
    if (event.type === 'started') { activeRequest = event.requestId; return; }
    if (event.requestId !== activeRequest) return;
    if (event.type === 'delta') { answer += event.delta; renderAnswer(); state('Answering locally…', 'busy'); }
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
    row.append(time, txt);
    $('meeting-transcript-list').append(row);
    $('meeting-transcript-list').scrollTop = $('meeting-transcript-list').scrollHeight;
  });
  api.onMeetingSummaryDelta(event => {
    answer += event.delta;
    renderAnswer();
    state('Generating meeting summary locally…', 'busy');
  });
  api.onMeetingSummaryDone(() => {
    lock(false);
    state('Meeting summary complete · decisions and action items ready');
  });
  api.onMeetingSummaryError(event => {
    lock(false);
    error(event.message);
  });
  window.addEventListener('beforeunload', () => { recorder.cancel(); meetingRecorder.cancel(); window.speechSynthesis?.cancel(); });
  guarded(async () => { await refreshStatus(); await refreshWindows(); });
}
