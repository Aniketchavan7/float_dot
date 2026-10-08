const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, session, protocol, clipboard, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { SettingsStore } = require('../services/settings');
const { OcrService } = require('../services/ocr');
const { TranscriptionService } = require('../services/transcription');
const { listModels, streamAnswer } = require('../services/model');
const { Coordinator } = require('../services/coordinator');
const { MeetingService } = require('../services/meeting');
const { text, MODES, validateAudio, validateCrop } = require('../shared/validation');

protocol.registerSchemesAsPrivileged([{ scheme: 'floatdot', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Float Dot');
const smoke = process.argv.includes('--smoke');
if (smoke) app.commandLine.appendSwitch('use-fake-device-for-media-stream');
if (smoke) app.setPath('userData', path.join(__dirname, '../../.artifacts/smoke-profile'));
const root = path.join(__dirname, '../..');
const assets = app.isPackaged ? path.join(process.resourcesPath, 'models') : path.join(root, '.models');
const temp = path.join(app.getPath('userData'), 'temporary-media');
const settings = new SettingsStore(app.getPath('userData'));
const ocr = new OcrService(assets);
const speech = new TranscriptionService(assets, temp);
let panel, dot, context = null, preparation = null, quitting = false;
const coordinator = new Coordinator({ infer: streamAnswer, emit: value => {
  if (panel && !panel.isDestroyed()) panel.webContents.send('fd:answer', value);
} });
const meeting = new MeetingService({
  speech,
  infer: streamAnswer,
  emit: (channel, data) => {
    if (panel && !panel.isDestroyed()) panel.webContents.send(channel, data);
  }
});

function trust(event) {
  const trusted = [panel, dot].some(win => win && !win.isDestroyed() && win.webContents === event.sender);
  if (!trusted || event.senderFrame?.url.split('#')[0] !== 'floatdot://app/index.html' || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted application request.');
}
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    try { trust(event); return { ok: true, value: await action(...args) }; }
    catch (error) { return { ok: false, error: error.name === 'AbortError' ? 'Request canceled.' : error.message }; }
  });
}
function cancel() {
  if (preparation) { preparation.controller.abort(); preparation = null; }
  coordinator.cancel();
  meeting.clear();
  if (panel && !panel.isDestroyed()) panel.webContents.send('fd:cancel-recording');
}
function ownSource(source) {
  return [panel, dot].some(win => {
    if (!win || win.isDestroyed()) return false;
    const handle = win.getNativeWindowHandle();
    const id = handle.length >= 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString();
    return source.id.split(':')[1] === id || source.name === 'Float Dot' || source.name === 'Float Dot · voice';
  });
}
async function capture(sourceId, crop) {
  text(sourceId, 'Window ID', 160);
  if (!sourceId.startsWith('window:')) throw new Error('Choose a window, not an entire display.');
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 2400, height: 1800 } });
  const source = sources.find(item => item.id === sourceId && !ownSource(item));
  if (!source || source.thumbnail.isEmpty()) throw new Error('Selected window is unavailable. Open it and choose it again.');
  let image = source.thumbnail;
  const bounds = validateCrop(crop, image.getSize());
  if (bounds) image = image.crop(bounds);
  const buffer = image.toPNG();
  if (buffer.length > 20 * 1024 * 1024) throw new Error('Window image is too large. Use a smaller window or crop.');
  return { buffer, preview: image.resize({ width: 640 }).toDataURL(), dimensions: image.getSize(), name: source.name };
}
async function status() {
  let models = [], modelError = null;
  try { models = await listModels(); } catch { modelError = 'Start Ollama locally with cloud disabled.'; }
  return { settings: settings.value, models, modelError, ocrReady: ocr.ready(), speechReady: await speech.ready(),
    shortcut: 'Ctrl+Shift+Space', offlineVerified: false, recoveredSettings: !!settings.recovered };
}
function installIPC() {
  handle('fd:status', status);
  handle('fd:settings', async input => { coordinator.clear(); return settings.update(input); });
  handle('fd:windows', async () => (await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 320, height: 200 } }))
    .filter(source => !ownSource(source) && !source.thumbnail.isEmpty())
    .map(source => ({ id: source.id, name: source.name, preview: source.thumbnail.toDataURL() })));
  handle('fd:prepare', async input => {
    if (!input || typeof input !== 'object') throw new Error('Invalid capture request.');
    const question = input.audio ? null : text(input.question, 'Question');
    const audio = input.audio ? validateAudio(input.audio) : null;
    cancel(); coordinator.clear(); context = null;
    const job = { id: randomUUID(), controller: new AbortController(), capturedAt: new Date().toISOString() };
    preparation = job;
    const timer = setTimeout(() => job.controller.abort(), 120000);
    try {
      const image = await capture(input.sourceId, input.crop);
      job.controller.signal.throwIfAborted();
      const transcript = audio ? await speech.transcribe(audio, job.controller.signal) : question;
      const extraction = await ocr.read(image.buffer, job.controller.signal);
      job.controller.signal.throwIfAborted();
      if (preparation !== job) throw new Error('Capture replaced by a newer request.');
      context = { id: job.id, capturedAt: job.capturedAt, name: image.name, text: extraction.text };
      return { ...context, transcript, preview: image.preview, dimensions: image.dimensions,
        confidence: extraction.confidence, truncated: extraction.truncated };
    } finally { clearTimeout(timer); if (preparation === job) preparation = null; }
  });
  handle('fd:transcribe', async input => {
    const audio = validateAudio(input);
    cancel();
    const job = { id: randomUUID(), controller: new AbortController() };
    preparation = job;
    try { return await speech.transcribe(audio, job.controller.signal); }
    finally { if (preparation === job) preparation = null; }
  });
  handle('fd:ask', async input => {
    const question = text(input?.question, 'Question');
    if (!context || input.contextId !== context.id) throw new Error('Capture a window first.');
    if (!MODES.includes(input.mode)) throw new Error('Unknown mode.');
    const models = await listModels();
    if (!models.some(model => model.name === settings.value.model)) throw new Error('Download the selected local Qwen3 model first.');
    // Runs asynchronously; answer events are scoped by the coordinator request ID.
    void coordinator.ask({ question, mode: input.mode, context: { ...context }, model: settings.value.model });
    return { accepted: true };
  });
  handle('fd:cancel', () => { cancel(); return true; });
  handle('fd:clear', () => { cancel(); coordinator.clear(); context = null; return true; });
  handle('fd:copy', value => { clipboard.writeText(text(value, 'Answer', 24000)); return true; });
  handle('fd:export', async value => {
    const content = text(value, 'Export', 30000);
    const chosen = await dialog.showSaveDialog(panel, { title: 'Export selected answer', defaultPath: 'float-dot-note.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (chosen.canceled) return false;
    await fs.writeFile(chosen.filePath, content, 'utf8'); return true;
  });
  handle('fd:collapse', () => { panel.hide(); dot.showInactive(); return true; });
  handle('fd:expand', () => { dot.hide(); panel.show(); return true; });
  handle('fd:meeting:start', async input => meeting.start(input));
  handle('fd:meeting:chunk', async input => meeting.addAudioChunk(input?.audio, input?.offsetSec || 0));
  handle('fd:meeting:pause', () => meeting.pause());
  handle('fd:meeting:resume', () => meeting.resume());
  handle('fd:meeting:stop', () => meeting.stop());
  handle('fd:meeting:clear', () => { meeting.clear(); return true; });
  handle('fd:meeting:delete-segment', input => meeting.deleteSegment(input?.id));
  handle('fd:meeting:summarize', async input => {
    const models = await listModels();
    if (!models.some(m => m.name === settings.value.model)) throw new Error('Download the selected local model first.');
    return meeting.summarize({ model: settings.value.model, customPrompt: input?.prompt });
  });
  handle('fd:meeting:export', async input => {
    const md = meeting.exportMarkdown(input?.summary);
    const chosen = await dialog.showSaveDialog(panel, {
      title: 'Export Meeting Notes',
      defaultPath: 'meeting-notes.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (chosen.canceled) return false;
    await fs.writeFile(chosen.filePath, md, 'utf8');
    return true;
  });
}
function configureSession() {
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(contents === panel?.webContents && contents.getURL() === 'floatdot://app/index.html' && permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin) => {
    return contents === panel?.webContents && origin === 'floatdot://app' && permission === 'media';
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // UI never loads remote fonts, scripts, media, images, or navigation.
    callback({ cancel: !details.url.startsWith('floatdot://app/') && !details.url.startsWith('data:') && !details.url.startsWith('blob:') });
  });
  const routes = new Map([
    ['/index.html', path.join(root, 'src/renderer/index.html')], ['/styles.css', path.join(root, 'src/renderer/styles.css')],
    ['/app.js', path.join(root, 'src/renderer/app.js')], ['/audio-worklet.js', path.join(root, 'src/renderer/audio-worklet.js')],
    ['/audio.js', path.join(root, 'src/renderer/audio.js')],
    ['/vendor/marked.js', path.join(root, 'node_modules/marked/lib/marked.umd.js')],
    ['/vendor/purify.js', path.join(root, 'node_modules/dompurify/dist/purify.min.js')],
    ['/vendor/prism.js', path.join(root, 'node_modules/prismjs/prism.js')]
  ]);
  protocol.handle('floatdot', async request => {
    const url = new URL(request.url);
    const file = url.hostname === 'app' && routes.get(url.pathname);
    if (!file) return new Response('Not found', { status: 404 });
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
    return new Response(await fs.readFile(file), { headers: { 'Content-Type': type } });
  });
}
function createWindows() {
  const bounds = screen.getPrimaryDisplay().workArea;
  panel = new BrowserWindow({ width: 480, height: Math.min(820, bounds.height - 40), minWidth: 400, minHeight: 600,
    x: bounds.x + bounds.width - 500, y: bounds.y + 20, title: 'Float Dot', show: false, alwaysOnTop: true,
    backgroundColor: '#f5f3ee', autoHideMenuBar: true,
    webPreferences: { preload: path.join(root, 'src/preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  dot = new BrowserWindow({ width: 84, height: 84, x: bounds.x + bounds.width - 104, y: bounds.y + bounds.height - 124,
    title: 'Float Dot · voice', frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, show: false,
    webPreferences: { preload: path.join(root, 'src/preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  for (const win of [panel, dot]) {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
  }
  panel.on('close', () => { cancel(); quitting = true; app.quit(); });
  panel.loadURL('floatdot://app/index.html');
  dot.loadURL('floatdot://app/index.html#dot');
  panel.once('ready-to-show', () => { if (!smoke) panel.show(); });
  screen.on('display-removed', () => {
    const area = screen.getPrimaryDisplay().workArea;
    panel.setPosition(area.x + 20, area.y + 20); dot.setPosition(area.x + area.width - 104, area.y + area.height - 124);
  });
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    dot.hide(); panel.show(); panel.webContents.send('fd:hotkey');
  });
}
async function smokeTest() {
  await new Promise(resolve => panel.webContents.isLoading() ? panel.webContents.once('did-finish-load', resolve) : resolve());
  await new Promise(resolve => setTimeout(resolve, 1200));
  const info = await panel.webContents.executeJavaScript(`({ title: document.title, bridge: typeof window.floatDot, ready: document.querySelector('#question') !== null, secure: window.isSecureContext })`);
  if (!info.ready || info.bridge !== 'object' || !info.secure) throw new Error(`UI smoke failed: ${JSON.stringify(info)}`);
  const image = await panel.webContents.capturePage();
  await fs.mkdir(path.join(root, '.artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, '.artifacts/app-smoke.png'), image.toPNG());
  const fixture = await panel.webContents.executeJavaScript(`(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 500;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,1200,500);
    ctx.fillStyle = '#202020'; ctx.font = '32px Arial';
    ['Two Sum', 'Given numbers [2, 7, 11, 15] and target = 9,', 'find the indices of two numbers whose sum is the target.', 'Each number may be used only once.'].forEach((line,i)=>ctx.fillText(line,40,70+i*75));
    return canvas.toDataURL('image/png');
  })()`);
  await fs.writeFile(path.join(root, '.artifacts/ocr-fixture.png'), Buffer.from(fixture.split(',')[1], 'base64'));
  const audioResult = await panel.webContents.executeJavaScript(`(async () => {
    const { Recorder } = await import('./audio.js');
    const recorder = new Recorder(() => {}); await recorder.start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    const wav = await recorder.stop();
    return { length: wav.length, active: recorder.active, wav: Array.from(wav) };
  })()`, true);
  validateAudio(new Uint8Array(audioResult.wav));
  if (audioResult.active) throw new Error('Microphone did not release after recording.');
  console.log('AUDIO_WORKLET_SMOKE_OK', JSON.stringify({ bytes: audioResult.length, fakeInput: true }));
  const target = new BrowserWindow({ width: 1100, height: 620, show: false, title: 'Float Dot test fixture',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  await target.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<title>Float Dot test fixture</title><body style="font:28px Arial;padding:30px;background:white;color:#202020"><h1>Two Sum</h1><p>Given numbers [2, 7, 11, 15] and target = 9,</p><p>find the indices of two numbers whose sum is the target.</p><p>Each number may be used only once.</p></body>'));
  target.showInactive();
  await new Promise(resolve => setTimeout(resolve, 700));
  const nativeHandle = target.getNativeWindowHandle();
  const nativeId = nativeHandle.length >= 8 ? nativeHandle.readBigUInt64LE().toString() : nativeHandle.readUInt32LE().toString();
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1, height: 1 } });
  const selected = sources.find(source => source.id.split(':')[1] === nativeId);
  if (!selected) throw new Error('Synthetic test window not available to desktop capture.');
  const captureResult = await panel.webContents.executeJavaScript(`window.floatDot.prepare(${JSON.stringify({ sourceId: selected.id, question: 'Give me one hint without the solution.' })})`);
  target.destroy();
  if (!captureResult.ok || !/two sum/i.test(captureResult.value?.text || '')) throw new Error(`Native capture/OCR smoke failed: ${captureResult.error || 'missing text'}`);
  console.log('WINDOW_CAPTURE_OCR_SMOKE_OK', JSON.stringify({ confidence: captureResult.value.confidence, chars: captureResult.value.text.length, syntheticOnly: true }));
  console.log('ELECTRON_SMOKE_OK', JSON.stringify(info));
  app.exit(0);
}
const single = app.requestSingleInstanceLock();
if (!single && !smoke) app.quit();
else app.whenReady().then(async () => {
  if (path.dirname(path.resolve(temp)) !== path.resolve(app.getPath('userData'))) throw new Error('Invalid temporary-media directory.');
  await fs.rm(temp, { recursive: true, force: true }); // verified app-owned child directory only
  await settings.load(); configureSession(); installIPC(); createWindows();
  if (smoke) await smokeTest();
}).catch(error => { console.error(error.message); app.exit(1); });
app.on('second-instance', () => { if (panel) { dot.hide(); panel.show(); } });
app.on('before-quit', () => { if (!quitting) { quitting = true; cancel(); } globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => app.quit());
