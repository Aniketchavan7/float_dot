import { Recorder, MeetingRecorder } from './audio.js';
import { OverlayController } from './overlay.js';
import { AnswerView } from './answer-view.js';
import { VoiceController, wantsFreshScreen } from './voice-controller.js';
import { SettingsView } from './settings-view.js';

const api = window.floatDot;
const $ = id => document.getElementById(id);
let mode = 'general', context = null, answer = '', activeRequest = null, epoch = 0, busy = false, micStarting = false;
let meetingActive = false, meetingPaused = false, meetingTimer = null, meetingStartEpoch = 0, meetingRequest = null;
let voiceTimer = null, voiceStartEpoch = 0;
let preferences = { confirmCapture: false, readAloud: false, theme: 'system', model: 'qwen3:1.7b' };
const providerLabels = { ollama: 'Ollama · local', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini', compatible: 'Custom API' };

function providerDescription() { return `${providerLabels[preferences.provider] || preferences.provider} · ${preferences.model}`; }

function formatHotkey(hotkey) {
  if (!hotkey) return 'Ctrl + Shift + Space';
  return hotkey.replace(/CommandOrControl/gi, 'Ctrl').replace(/\+/g, ' + ');
}

function providerFields() {
  const choice = $('provider').value;
  $('endpoint-field').hidden = choice !== 'compatible';
  $('key-field').hidden = choice === 'ollama';
}

let speechReady = false;
let reviewReusesCapture = false;
const voice = new VoiceController({transcribe:wav=>call('transcribe',wav)});
const recorder = new Recorder(() => guarded(record), e => { ++epoch; voice.cancel(); stopped(); error(e.message); });
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

let overlay = null;
let answerView = null;
let settingsView = null;

function state(label, kind = 'idle') {
  if (overlay) overlay.setState(label, kind);
  else {
    $('status-text').textContent = label;
    document.body.dataset.state = kind;
  }
}

function error(message) {
  if (overlay) overlay.showError(message);
  else {
    $('error').textContent = message;
    $('error').hidden = false;
    state('Needs attention', 'error');
  }
}

function resetError() {
  if (overlay) overlay.hideError();
  else $('error').hidden = true;
}

function answerState(label, complete = false) {
  if (answerView) answerView.setState(label, complete);
  else {
    $('answer-state').textContent = label;
    $('answer-state').dataset.complete = String(complete);
    for (const id of ['copy', 'export', 'speak']) $(id).disabled = !complete;
  }
}

function renderAnswer(isFinal = false) {
  if (answerView) answerView.render(answer, isFinal);
  else {
    if (!answer) { $('answer').innerHTML = ''; return; }
    const html = window.marked.parse(answer, { breaks: true });
    $('answer').innerHTML = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ALLOWED_ATTR: ['class']
    });
    if (isFinal && window.Prism) window.Prism.highlightAllUnder($('answer'));
  }
}

function scheduleRender(isFinal = false) {
  renderAnswer(isFinal);
}

function lock(value) {
  busy = value;
  $('send').disabled = value;
  $('capture').disabled = value;
  $('record').disabled = value;
  $('confirm').disabled = value;
  $('source').disabled = value;
  $('refresh-windows').disabled = value;
  $('stop').hidden = !value;
  $('answer-stop').hidden = !value;
  $('meeting-summarize').disabled = value;
  $('meeting-record').disabled = value || meetingActive;
  $('crop-capture').disabled = value;
  $('open-screenshot').disabled = value;
  $('paste-screenshot').disabled = value;
  $('snip').disabled = value;
}

function setVoiceState(status) {
  const recBtn = $('record');
  const recLabel = $('record-label');
  const recSymbol = recBtn?.querySelector('.record-symbol');
  const recWave = $('rec-wave');
  clearInterval(voiceTimer);

  if (status === 'recording') {
    recBtn?.classList.add('is-recording');
    recBtn?.classList.remove('is-transcribing');
    if (recBtn) recBtn.disabled = false;
    if (recSymbol) recSymbol.textContent = '⏹';
    if (recWave) recWave.hidden = false;
    $('capture').disabled = true;
    $('stop').hidden = false;

    voiceStartEpoch = Date.now();
    const update = () => {
      const elapsed = Math.floor((Date.now() - voiceStartEpoch) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      if (recLabel) recLabel.textContent = `Stop (${mm}:${ss})`;
    };
    update();
    voiceTimer = setInterval(update, 500);
    state('Listening to voice… Stop when done', 'recording');
  } else if (status === 'transcribing') {
    recBtn?.classList.remove('is-recording');
    recBtn?.classList.add('is-transcribing');
    if (recBtn) recBtn.disabled = true;
    if (recSymbol) recSymbol.innerHTML = '…';
    if (recLabel) recLabel.textContent = 'Transcribing…';
    if (recWave) recWave.hidden = true;
    $('capture').disabled = true;
    $('stop').hidden = false;
    state('Transcribing audio…', 'busy');
  } else {
    // idle
    recBtn?.classList.remove('is-recording', 'is-transcribing');
    if (recBtn) recBtn.disabled = false;
    if (recSymbol) recSymbol.textContent = '●';
    if (recLabel) recLabel.textContent = 'Voice';
    if (recWave) recWave.hidden = true;
    $('capture').disabled = false;
    $('stop').hidden = true;
  }
}

function stopped() {
  recorder.cancel();
  micStarting = false;
  setVoiceState('idle');
  if (!busy) lock(false);
}

async function guarded(action) {
  try {
    resetError();
    await action();
  } catch (e) {
    if (busy) answerState('Incomplete · check the error and retry');
    lock(false);
    stopped();
    error(e.message);
  }
}

async function refreshStatus() {
  const status = await call('status');
  speechReady = status.speechReady;
  $('voice-setup').hidden = speechReady;
  preferences = status.settings;
  mode = preferences.mode;

  $('provider').value = preferences.provider;
  $('endpoint').value = preferences.baseURL;
  $('send-image').checked = preferences.sendImage;
  providerFields();

  $('key-status').textContent = status.keySaved
    ? 'A key is saved with OS encryption. It is never shown here.'
    : 'No saved key. A key is optional for some custom endpoints.';

  const destination = preferences.provider === 'ollama'
    ? 'Only the local Ollama server receives your question and capture.'
    : `Your question and ${preferences.sendImage ? 'screenshot image' : 'extracted screen text'} are sent to ${preferences.provider === 'compatible' ? preferences.baseURL || 'your configured endpoint' : providerLabels[preferences.provider]}. Your provider may charge for usage.`;

  $('provider-notice').textContent = destination;
  $('processing-location').textContent = providerDescription();
  if ($('header-model-badge')) $('header-model-badge').textContent = preferences.model;

  $('reasoning').checked = preferences.reasoning;
  $('hotkey').value = preferences.hotkey;
  $('shortcut-label').textContent = formatHotkey(preferences.hotkey);

  $('microphone').replaceChildren(new Option('System default', ''));
  const microphones = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput');
  microphones.forEach((device, index) => $('microphone').add(new Option(device.label || `Microphone ${index + 1}`, device.deviceId)));
  if (preferences.microphoneId && !microphones.some(device => device.deviceId === preferences.microphoneId)) {
    $('microphone').add(new Option('Previously selected microphone (unavailable)', preferences.microphoneId));
  }
  $('microphone').value = preferences.microphoneId;

  setModeButtons();
  setTheme();
  $('confirm-capture').checked = preferences.confirmCapture;
  $('read-aloud').checked = preferences.readAloud;
  $('theme').value = preferences.theme;

  $('model-options').replaceChildren();
  const available = [...new Set([preferences.model, ...status.models.map(m => m.name)])];
  for (const name of available) $('model-options').append(new Option(name, name));
  $('model').value = preferences.model;

  $('readiness').replaceChildren();
  const providerReady = preferences.provider === 'ollama'
    ? status.models.some(m => m.name === preferences.model)
    : preferences.provider === 'compatible' ? !!preferences.baseURL : status.keySaved;

  const rows = [
    [providerLabels[preferences.provider] || 'AI Provider', providerReady],
    [preferences.sendImage ? 'Screenshot image mode' : 'Screen text', preferences.sendImage || status.ocrReady],
    ['Voice recognition (optional)', status.speechReady]
  ];

  for (const [label, ready] of rows) {
    const row = document.createElement('div');
    row.className = 'readiness-row' + (ready ? '' : ' missing');
    const left = document.createElement('span'), right = document.createElement('span');
    left.textContent = label;
    right.textContent = ready ? 'Ready' : 'Setup needed';
    row.append(left, right);
    $('readiness').append(row);
  }

  const ready = settingsView ? settingsView.refresh(status) : rows.slice(0, 2).every(([, value]) => value);
  if (!settingsView) $('setup').hidden = ready;
  state(ready ? 'Ready · Entire screen' : 'Setup needed · open AI settings');

  renderCapabilities(status.capabilities);

  if (status.modelError) error(status.modelError);
  if (status.shortcutError) error(status.shortcutError);
}

function renderCapabilities(caps) {
  const container = $('capability-badges');
  if (!container) return;
  container.replaceChildren();
  if (!caps) return;

  if (caps.isLocal) {
    const b = document.createElement('span');
    b.className = 'cap-badge success';
    b.textContent = '🔒 Local · Private';
    container.appendChild(b);
  }
  if (caps.supportsVision) {
    const b = document.createElement('span');
    b.className = 'cap-badge active';
    b.textContent = '🖼️ Vision Supported';
    container.appendChild(b);
  }
  if (caps.supportsReasoning) {
    const b = document.createElement('span');
    b.className = 'cap-badge active';
    b.textContent = '🧠 Reasoning Model';
    container.appendChild(b);
  }
  if (caps.isEmbedding) {
    const b = document.createElement('span');
    b.className = 'cap-badge warning';
    b.textContent = '⚠️ Embedding Only (Incompatible)';
    container.appendChild(b);
  }
}

function setTheme() {
  if (preferences.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preferences.theme;
}

function setModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  const isMeeting = mode === 'meeting';
  if ($('meeting-inputs')) $('meeting-inputs').hidden = !isMeeting;
}

async function refreshWindows() {
  const previous = $('source').value;
  let windows = [];
  try { windows = await call('windows'); } catch { windows = []; }

  $('source').replaceChildren();
  $('source').add(new Option('🖥️ Entire Screen', 'screen:default'));

  windows.forEach(win => {
    if (win.id.startsWith('screen:')) {
      if (windows.filter(w => w.id.startsWith('screen:')).length > 1) {
        $('source').add(new Option(`🖥️ ${win.name}`, win.id));
      }
    } else {
      $('source').add(new Option(`🪟 ${win.name}`, win.id));
    }
  });

  if (previous && previous !== 'screen:default' && !windows.some(win => win.id === previous)) {
    $('source').add(new Option('Previously selected source (unavailable)', previous));
    $('source').value = previous;
  } else if (previous && windows.some(win => win.id === previous)) {
    $('source').value = previous;
  } else {
    $('source').value = 'screen:default';
  }
}

async function prepare(audio, crop, openScreenshot = false, region = false) {
  reviewReusesCapture=false;
  const sourceId = $('source').value || 'screen:default';
  const version = ++epoch;
  lock(true);
  state(audio ? 'Transcribing & reading screen…' : 'Reading screen…', 'busy');

  context = null;
  if (answerView) answerView.hide();
  else $('answer-section').hidden = true;
  $('capture-review').hidden = true;

  let captured;
  try {
    captured = await call('prepare', { sourceId, question: $('question').value, audio, crop, openScreenshot, region });
  } catch (e) {
    setVoiceState('idle');
    if (version !== epoch) return;
    throw e;
  }
  setVoiceState('idle');

  if (version !== epoch) return;
  if (!captured) {
    lock(false);
    state('No screenshot selected');
    return;
  }

  context = captured;
  $('question').value = captured.transcript;
  $('review-question').value = captured.transcript;
  $('preview').src = captured.preview;
  $('capture-meta').textContent = `${captured.name} · ${new Date(captured.capturedAt).toLocaleTimeString()} · ${captured.dimensions.width}×${captured.dimensions.height}`;
  $('extracted').textContent = captured.text;
  $('crop-capture').closest('details').hidden = !!openScreenshot || region;
  // Review must include the actual preview/evidence, not only a confirm button.
  $('capture-review').prepend($('evidence-details'));
  $('evidence-details').open = preferences.confirmCapture;
  $('crop-x').value = 0;
  $('crop-y').value = 0;
  $('crop-width').value = captured.dimensions.width;
  $('crop-height').value = captured.dimensions.height;
  $('ocr-warning').hidden = captured.confidence >= 75 && !captured.truncated;
  $('ocr-warning').textContent = 'Check extracted text. Operators or small code may be misread' + (captured.truncated ? '; only the first part is included.' : '.');

  if (!preferences.confirmCapture) {
    await ask();
  } else {
    $('capture-review').hidden = false;
    lock(false);
    state(`Capture ready · ${providerDescription()}`);
    $('confirm').textContent = `Explain with ${providerLabels[preferences.provider] || 'AI'}`;
  }
}

async function ask(customQuestion = null) {
  if (!context) throw new Error('Capture screen or window first.');
  const q = (customQuestion || $('question').value).trim();
  if (!q) throw new Error('Add a question or ask aloud first.');

  lock(true);
  answer = '';
  answerState('Generating · wait for completion');
  activeRequest = null;
  renderAnswer();

  const meta = `${providerDescription()} · ${context.name} · ${new Date(context.capturedAt).toLocaleTimeString()}`;
  if (answerView) answerView.show(meta);
  else $('answer-section').hidden = false;
  $('answer-section').append($('evidence-details'));
  $('evidence-details').open = false;
  $('capture-review').hidden = true;
  state(`Asking ${providerDescription()}…`, 'busy');
  voice.submitted();
  await call('ask', { question: q, mode, contextId: context.id });
}

async function sendQuestion() {
  if (busy || recorder.active || micStarting) return;
  voice.cancel();$('voice-timing').hidden=true;
  const q = $('question').value.trim();
  if (!q) {
    await prepare();
    return;
  }
  if (context && $('reuse-capture').checked) {
    await ask();
  } else {
    await prepare();
  }
}

async function record() {
  if (busy) return;
  if (recorder.active) {
    const wav = await recorder.stop();
    const version=++epoch;
    lock(true);setVoiceState('transcribing');
    const transcript=await voice.recognize(wav);
    if(version!==epoch || transcript===null)return;
    lock(false);setVoiceState('idle');
    $('question').value=transcript;
    if (context && answer && $('reuse-capture').checked && !wantsFreshScreen(transcript)) {
      if (preferences.confirmCapture) {
        reviewReusesCapture=true;
        $('review-question').value=transcript;
        $('capture-review').prepend($('evidence-details'));
        $('evidence-details').open=true;
        $('capture-review').hidden=false;
        $('confirm').textContent='Send corrected follow-up';
        state('Review voice question · reusing captured screen');
      } else await ask();
    } else {
      await prepare();
    }
    return;
  }

  if (micStarting) return;
  if (!speechReady) {
    $('setup').hidden=false;
    throw new Error('Optional voice setup is missing. See Voice setup in AI Settings; typing and Read still work.');
  }
  window.speechSynthesis?.cancel();
  const version=++epoch;
  voice.cancel();
  micStarting = true;
  lock(true);busy=false;
  $('record').disabled = true;
  $('stop').hidden=false;
  state('Opening microphone…','busy');

  try {
    await recorder.start(preferences.microphoneId);
  } catch(e) {
    if(version!==epoch)return;
    throw e;
  } finally {
    if(version===epoch)micStarting = false;
  }
  if(version!==epoch)return;
  if (!recorder.active) {
    stopped();
    return;
  }
  setVoiceState('recording');
}

async function stop() {
  voice.cancel();
  if (busy) answerState('Incomplete · stopped');
  ++epoch;
  activeRequest = null;
  meetingRequest = null;
  await stopMeeting();
  lock(false);
  stopped();
  window.speechSynthesis?.cancel();
  await call('cancel');
  state('Stopped · ready');
}

async function clear() {
  $('voice-timing').hidden=true;
  await stop();
  await call('clear');
  context = null;
  answer = '';
  if (answerView) answerView.clear();
  else {
    renderAnswer(true);
    $('session-badge').hidden = true;
    $('answer-section').hidden = true;
  }
  $('meeting-transcript-list').replaceChildren();
  $('meeting-transcript-section').hidden = true;
  $('capture-review').hidden = true;
  $('question').value = '';
}

function readAloud() {
  if (recorder.active || meetingActive || micStarting) throw new Error('Stop recording before reading aloud.');
  if (!answer) return;
  const voice = window.speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith('en'));
  if (!voice) throw new Error('No installed local English voice is available. Text answers still work.');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance($('answer').textContent);
  utterance.voice = voice;
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
  state('Meeting recording started · speaking into room mic', 'recording');

  clearInterval(meetingTimer);
  meetingTimer = setInterval(updateMeetingTimer, 1000);
  $('meeting-transcript-list').replaceChildren();
  answer = '';
  renderAnswer();

  try {
    await call('meetingStart');
    await meetingRecorder.start(preferences.microphoneId);
  } catch (e) {
    meetingRecorder.cancel();
    meetingActive = false;
    meetingPaused = false;
    clearInterval(meetingTimer);
    $('meeting-record-label').textContent = 'Start Meeting';
    $('meeting-record').disabled = false;
    $('meeting-pause').hidden = true;
    $('meeting-stop').hidden = true;
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
  state('Meeting stopped · review transcript or summarize', 'idle');
}

async function clearMeeting() {
  meetingRequest = null;
  await stopMeeting();
  await call('meetingClear');
  $('meeting-transcript-list').replaceChildren();
  answer = '';
  renderAnswer();
  if (answerView) answerView.hide();
  else $('answer-section').hidden = true;
  $('meeting-transcript-section').hidden = true;
  state('Meeting session cleared');
}

async function summarizeMeeting() {
  await stopMeeting();
  const version = ++epoch;
  meetingRequest = null;
  lock(true);
  answer = '';
  answerState('Generating meeting notes · wait for completion');
  renderAnswer();
  if (answerView) answerView.show(`Meeting Summary · ${new Date().toLocaleTimeString()}`);
  else $('answer-section').hidden = false;
  state('Extracting decisions and action items…', 'busy');
  try { await call('meetingSummarize'); }
  catch (e) { if (version === epoch) throw e; }
}

async function exportMeeting() {
  const saved = await call('meetingExport', { summary: answer });
  if (saved) state('Meeting notes exported successfully');
}

function on(id, action) {
  const el = $(id);
  if (el) el.addEventListener('click', () => guarded(action));
}

// Module initialization
if (location.hash === '#dot') {
  document.body.classList.add('dot-view');
  $('floating-dot')?.addEventListener('click', () => call('expand').catch(() => {}));
} else {
  overlay = new OverlayController({
    onModeChange: () => {}, // The guarded mode handler below owns cancellation and persistence.
    onOpacityChange: () => {},
    onSourceChange: () => {}
  });

  answerView = new AnswerView({
    onFollowUp: (q, reuse) => {
      if (busy || recorder.active || micStarting) return;
      voice.cancel();$('voice-timing').hidden=true;
      if (reuse && context) {
        guarded(() => ask(q));
      } else {
        $('question').value = q;
        guarded(() => prepare());
      }
    },
    onCopy: text => {
      call('copy', text).then(() => state('Answer copied to clipboard'));
    },
    onExport: text => {
      call('export', `# Float Dot note\n\nSource: ${context?.name}\nCaptured: ${context?.capturedAt}\n\n${text}`);
    },
    onClear: () => guarded(clear)
  });

  on('send', sendQuestion);
  on('record', record);
  on('stop', stop);
  on('capture', () => prepare());
  on('confirm', () => {
    $('question').value=$('review-question').value;
    if(reviewReusesCapture && wantsFreshScreen($('review-question').value))return prepare();
    return ask($('review-question').value);
  });
  on('open-screenshot', () => prepare(undefined, undefined, true));
  on('paste-screenshot', () => prepare(undefined, undefined, 'clipboard'));
  on('snip', () => prepare(undefined, undefined, false, true));

  $('question').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      guarded(sendQuestion);
    }
  });

  settingsView = new SettingsView({
    call,
    state,
    error,
    resetError,
    onBeforeSave: async () => { await stop(); },
    onSave: async updated => {
      preferences = updated;
      await refreshStatus();
    },
    onStatusChange: refreshStatus
  });
  settingsView.init();

  on('answer-stop', stop);
  on('crop-capture', () => prepare(undefined, Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number($('crop-' + key).value)]))));
  on('refresh-windows', refreshWindows);
  on('refresh-status', refreshStatus);

  on('save-hotkey', async () => {
    await stop();
    preferences = await call('settings', { hotkey: $('hotkey').value.trim() });
    $('shortcut-label').textContent = formatHotkey(preferences.hotkey);
    state('Shortcut saved');
  });

  $('microphone').addEventListener('change', () => guarded(async () => {
    await stop();
    preferences = await call('settings', { microphoneId: $('microphone').value });
  }));

  on('collapse', async () => { await stop(); await call('collapse'); });
  on('close', async () => { await stop(); await call('close'); });
  on('discard', clear);
  on('speak', readAloud);
  on('settings-toggle', () => {
    if (settingsView) settingsView.toggle();
    else $('setup').hidden = !$('setup').hidden;
    $('overflow-menu').hidden = true;
  });
  on('settings-close', () => {
    if (settingsView) settingsView.hide();
    else $('setup').hidden = true;
  });
  on('hide', async () => { await stop(); await call('hide'); });
  on('pin', async () => {
    const pinned = await call('pin', $('pin').getAttribute('aria-pressed') !== 'true');
    $('pin').setAttribute('aria-pressed', String(pinned));
    $('pin').textContent = pinned ? 'Pinned on top' : 'Pin on top';
  });
  api.onFocusInput(() => $('question').focus());
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (busy || recorder.active || micStarting || meetingActive) { event.preventDefault(); guarded(stop); }
    else if (event.defaultPrevented) return;
    else if (!$('setup').hidden) { $('setup').hidden = true; event.preventDefault(); }
    else { event.preventDefault(); guarded(() => call('collapse')); }
  });

  // Size the native input rectangle to visible UI, not an invisible 800px dashboard.
  let layoutTimer, lastHeight = 0, layoutRunning = false;
  async function resizePanel() {
    if (layoutRunning) return;
    const height = Math.ceil($('panel').getBoundingClientRect().height + 16);
    if (height === lastHeight) return;
    layoutRunning = true; lastHeight = height;
    try {
      const result = await call('layout', { height });
      document.documentElement.style.setProperty('--display-height', `${result.workArea.height}px`);
      $('pin').setAttribute('aria-pressed', String(result.pinned));
      $('pin').textContent = result.pinned ? 'Pinned on top' : 'Pin on top';
    } catch { lastHeight = 0; }
    finally { layoutRunning = false; }
  }
  const scheduleLayout = () => { clearTimeout(layoutTimer); layoutTimer = setTimeout(resizePanel, 40); };
  new ResizeObserver(scheduleLayout).observe($('panel'));
  new MutationObserver(scheduleLayout).observe($('panel'), { attributes:true,childList:true,subtree:true,characterData:true });
  api.onDisplayChanged(() => { lastHeight = 0; scheduleLayout(); });
  scheduleLayout();

  on('meeting-record', startMeeting);
  on('meeting-pause', pauseMeeting);
  on('meeting-stop', stopMeeting);
  on('meeting-clear', clearMeeting);
  on('meeting-summarize', summarizeMeeting);
  on('meeting-export', exportMeeting);

  $('source').addEventListener('change', () => guarded(clear));

  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => guarded(async () => {
    await stop();
    context = null;
    answer = '';
    renderAnswer();
    if (answerView) answerView.hide();
    else $('answer-section').hidden = true;
    $('capture-review').hidden = true;
    mode = button.dataset.mode;
    preferences = await call('settings', { mode });
    setModeButtons();
  })));

  for (const [id, key] of [['confirm-capture', 'confirmCapture'], ['read-aloud', 'readAloud'], ['reasoning', 'reasoning'], ['theme', 'theme']]) {
    $(id).addEventListener('change', () => guarded(async () => {
      await stop();
      preferences = await call('settings', { [key]: $(id).type === 'checkbox' ? $(id).checked : $(id).value });
      setTheme();
    }));
  }

  api.onHotkey(() => guarded(mode === 'meeting' ? (meetingActive ? stopMeeting : startMeeting) : record));

  api.onCancel(() => {
    recorder.cancel();
    meetingRecorder.cancel();
    meetingActive = false;
    meetingPaused = false;
    clearInterval(meetingTimer);
    $('meeting-record-label').textContent = 'Start Meeting';
    $('meeting-record').disabled = false;
    $('meeting-pause').hidden = true;
    $('meeting-stop').hidden = true;
    micStarting = false;
    if (!busy) stopped();
  });

  api.onAnswer(event => {
    if (event.type === 'started') {
      activeRequest = event.requestId;
      state(`Answering · ${providerDescription()}`, 'busy');
      return;
    }
    if (event.requestId !== activeRequest) return;
    if (event.type === 'delta') {
      const timings=voice.firstAnswer();
      if(timings?.firstAnswerMs!==undefined) {
        $('voice-timing').hidden=false;
        $('voice-timing').textContent=`Voice: transcription ${Math.round(timings.transcriptionMs)} ms · answer after send ${Math.round(timings.firstAnswerMs)} ms`;
      }
      answer += event.delta;
      scheduleRender(false);
    }
    if (event.type === 'done') {
      if (typeof event.answer === 'string') answer = event.answer;
      answerState(event.warnings?.length ? `Complete · ${event.warnings.join(' ')}` : 'Complete', true);
      lock(false);
      scheduleRender(true);
      state('Answer complete · ready for follow-up');
      if (answerView) answerView.setSessionBadge(event.turn || 1);
      if (preferences.readAloud) guarded(readAloud);
    }
    if (event.type === 'error') {
      answerState('Incomplete · retry or choose a different model');
      lock(false);
      error(event.message);
    }
    if (event.type === 'canceled') {
      answerState('Incomplete · stopped');
      lock(false);
      state('Answer stopped');
    }
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
    const remove = document.createElement('button');
    remove.className = 'text-button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => guarded(async () => {
      await call('meetingDeleteSegment', { id: segment.id });
      row.remove();
      meetingRequest = null;
      answer = '';
      renderAnswer(true);
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
    scheduleRender(false);
  });
  api.onMeetingSummaryDone(event => {
    if (event.requestId !== meetingRequest) return;
    lock(false);
    answerState('Complete', true);
    scheduleRender(true);
    state('Meeting summary ready');
  });
  api.onMeetingSummaryError(event => {
    if (event.requestId !== meetingRequest) return;
    lock(false);
    answerState('Incomplete · meeting notes were not finished');
    error(event.message);
  });

  window.addEventListener('beforeunload', () => {
    recorder.cancel();
    meetingRecorder.cancel();
    window.speechSynthesis?.cancel();
  });

  guarded(async () => {
    await refreshStatus();
    await refreshWindows();
  });
}
