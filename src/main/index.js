const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, session, protocol, clipboard, dialog, Tray, Menu, nativeImage, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { SettingsStore } = require('../services/settings');
const { CredentialStore } = require('../services/credentials');
const { streamProvider, LABELS } = require('../services/providers');
const { OcrService } = require('../services/ocr');
const { TranscriptionService } = require('../services/transcription');
const { listModels } = require('../services/model');
const { Coordinator } = require('../services/coordinator');
const { MeetingService } = require('../services/meeting');
const { text, MODES, validateAudio, validateCrop, validateSettings } = require('../shared/validation');

protocol.registerSchemesAsPrivileged([{ scheme: 'floatdot', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Float Dot');
const smoke = process.argv.includes('--smoke');
if (smoke) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}
if (smoke) app.setPath('userData', path.join(__dirname, '../../.artifacts/smoke-profile'));
const root = path.join(__dirname, '../..');
const assets = app.isPackaged ? path.join(process.resourcesPath, 'models') : path.join(root, '.models');
const temp = path.join(app.getPath('userData'), 'temporary-media');
const settings = new SettingsStore(app.getPath('userData'));
const credentials = new CredentialStore(app.getPath('userData'), safeStorage);
const ocr = new OcrService(assets);
const speech = new TranscriptionService(assets, temp);
let panel, dot, context = null, preparation = null, quitting = false, requestRevision = 0;
let tray, registeredHotkey = null, shortcutError = null;
function registerHotkey(value) {
  if (value === registeredHotkey) return;
  if (registeredHotkey) {
    try { globalShortcut.unregister(registeredHotkey); } catch {}
  }
  const registered = globalShortcut.register(value, () => {
    dot.hide(); panel.show(); panel.focus(); panel.webContents.send('fd:hotkey');
  });
  if (!registered) {
    if (!smoke) shortcutError = 'Shortcut is in use by another application. You can customize it in AI settings.';
    return;
  }
  registeredHotkey = value;
  shortcutError = null;
}
const infer = input => {
  const config = { ...settings.value };
  return streamProvider({ ...input, provider: config.provider, baseURL: config.baseURL, apiKey: credentials.get(config), reasoning: config.reasoning,
    image: config.sendImage ? input.image : undefined });
};
async function checkProvider() {
  if (settings.value.provider === 'ollama') {
    if (!(await listModels()).some(model => model.name === settings.value.model)) throw new Error('Download or choose an installed Ollama model.');
  } else if (settings.value.provider === 'compatible') {
    if (!settings.value.baseURL) throw new Error('Set the compatible API base URL in AI settings.');
  } else if (!credentials.get(settings.value)) throw new Error('Save your API key in AI settings.');
}
const coordinator = new Coordinator({ infer, maxHistory: 8, emit: value => {
  if (panel && !panel.isDestroyed()) panel.webContents.send('fd:answer', value);
} });
const meeting = new MeetingService({
  speech,
  infer,
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
  requestRevision++;
  if (preparation) { preparation.controller.abort(); preparation = null; }
  coordinator.cancel();
  meeting.cancelSummary();
  meeting.stop();
  if (panel && !panel.isDestroyed()) panel.webContents.send('fd:cancel-recording');
}
const IGNORED_WINDOW_NAMES = [
  /^npm(\.cmd)?\s+start/i,
  /^nvidia\s+geforce\s+overlay/i,
  /^geforce\s+overlay/i,
  /^program\s+manager$/i,
  /^default\s+ime$/i,
  /^windows\s+input\s+experience$/i,
  /^task\s+switching$/i,
  /^battery\s+flyout$/i,
  /^network\s+flyout$/i,
  /^volume\s+flyout$/i,
  /^clockflyout$/i,
  /^settings$/i,
  /^float\s*dot/i
];
function isIgnoredWindow(source) {
  if (!source || !source.name) return true;
  const trimmed = source.name.trim();
  if (trimmed.length < 2) return true;
  return IGNORED_WINDOW_NAMES.some(pattern => pattern.test(trimmed));
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
  const isDefaultScreen = !sourceId || sourceId === 'screen:default' || sourceId === 'screen:primary';
  if (!isDefaultScreen) {
    text(sourceId, 'Window ID', 160);
    if (!/^(window|screen):/.test(sourceId)) throw new Error('Choose a window or display.');
  }
  const wasVisible = panel.isVisible(), dotVisible = dot.isVisible();
  const willHide = isDefaultScreen || (sourceId && sourceId.startsWith('screen:'));
  if (willHide) { panel.hide(); dot.hide(); await new Promise(resolve => setTimeout(resolve, 150)); }
  let sources;
  try { sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 2400, height: 1800 } }); }
  finally { if (willHide) { if (wasVisible) panel.show(); else if (dotVisible) dot.showInactive(); } }
  let source;
  if (!isDefaultScreen) {
    source = sources.find(item => item.id === sourceId && !ownSource(item));
  } else {
    source = sources.find(item => item.id.startsWith('screen:') && !ownSource(item)) || sources.find(item => !ownSource(item));
  }
  if (!source || source.thumbnail.isEmpty()) throw new Error('Selected screen or window is unavailable.');
  let image = source.thumbnail;
  const bounds = validateCrop(crop, image.getSize());
  if (bounds) image = image.crop(bounds);
  const buffer = image.toPNG();
  if (buffer.length > 20 * 1024 * 1024) throw new Error('Window image is too large. Use a smaller window or crop.');
  return { buffer, preview: image.resize({ width: 640 }).toDataURL(), dimensions: image.getSize(), name: source.name || 'Entire Screen' };
}
async function status() {
  let models = [], modelError = null;
  if (settings.value.provider === 'ollama') {
    try { models = await listModels(); } catch { modelError = 'Start Ollama to use local models.'; }
  }
  let keySaved = false;
  try { keySaved = !!credentials.get(settings.value); } catch (error) { modelError = error.message; }
  return { settings: settings.value, models, modelError, ocrReady: ocr.ready(), speechReady: await speech.ready(),
    keySaved, providerLabel: LABELS[settings.value.provider], shortcut: settings.value.hotkey, shortcutError, offlineVerified: false, recoveredSettings: !!settings.recovered };
}
function installIPC() {
  handle('fd:status', status);
  handle('fd:settings', async input => {
    const validated = validateSettings(input);
    const previous = settings.value.hotkey;
    if (validated.hotkey) registerHotkey(validated.hotkey);
    try { cancel(); const value = await settings.update(validated); coordinator.clear(); return value; }
    catch (error) { if (registeredHotkey !== previous) registerHotkey(previous); throw error; }
  });
  handle('fd:credentials', async input => {
    if (typeof input?.key !== 'string') throw new Error('Invalid key input.');
    await credentials.set(settings.value, input.key); return true;
  });
  handle('fd:windows', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
    const screens = sources.filter(s => s.id.startsWith('screen:') && !ownSource(s));
    const result = [];
    if (screens.length > 0) {
      result.push({ id: screens[0].id, name: 'Entire Screen' });
      for (let i = 1; i < screens.length; i++) {
        result.push({ id: screens[i].id, name: `Display ${i + 1}` });
      }
    }
    const windows = sources.filter(s => s.id.startsWith('window:') && !ownSource(s) && !isIgnoredWindow(s));
    for (const win of windows) {
      result.push({ id: win.id, name: win.name });
    }
    return result;
  });
  handle('fd:prepare', async input => {
    if (!input || typeof input !== 'object') throw new Error('Invalid capture request.');
    const question = input.audio ? null : text(input.question || 'Explain what is visible in this screenshot.', 'Question');
    const audio = input.audio ? validateAudio(input.audio) : null;
    cancel(); coordinator.clear(); context = null;
    const job = { id: randomUUID(), controller: new AbortController(), capturedAt: new Date().toISOString() };
    preparation = job;
    const timer = setTimeout(() => job.controller.abort(), 120000);
    try {
      let image;
      if (input.openScreenshot === true || input.openScreenshot === 'clipboard') {
        let bitmap, name;
        if (input.openScreenshot === 'clipboard') { bitmap = clipboard.readImage(); name = 'Clipboard screenshot'; }
        else {
          const chosen = await dialog.showOpenDialog(panel, { title: 'Open a screenshot', properties: ['openFile'], filters: [{ name: 'Screenshots', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
          if (chosen.canceled) return null;
          const file = chosen.filePaths[0];
          if ((await fs.stat(file)).size > 20 * 1024 * 1024) throw new Error('Choose a screenshot smaller than 20 MB.');
          bitmap = nativeImage.createFromBuffer(await fs.readFile(file)); name = path.basename(file);
        }
        if (bitmap.isEmpty()) throw new Error('Screenshot could not be read. Choose a PNG or JPEG image.');
        if (bitmap.getSize().width > 2400) bitmap = bitmap.resize({ width: 2400 });
        image = { buffer: bitmap.toPNG(), preview: bitmap.resize({ width: 640 }).toDataURL(), dimensions: bitmap.getSize(), name };
      } else image = await capture(input.sourceId, input.crop);
      if (image.buffer.length > 20 * 1024 * 1024) throw new Error('Screenshot is too large. Choose a smaller image.');
      job.controller.signal.throwIfAborted();
      const transcript = audio ? await speech.transcribe(audio, job.controller.signal) : question;
      const extraction = settings.value.sendImage ? { text: '[Screenshot supplied as image. Read visible content directly; identify unreadable details.]', confidence: 100, truncated: false }
        : await ocr.read(image.buffer, job.controller.signal);
      job.controller.signal.throwIfAborted();
      if (preparation !== job) throw new Error('Capture replaced by a newer request.');
      context = { id: job.id, sourceId: input.sourceId || 'screen:default', capturedAt: job.capturedAt, name: image.name, text: extraction.text, image: image.buffer.toString('base64'), imageMode: settings.value.sendImage };
      const { image: _image, ...publicContext } = context;
      return { ...publicContext, transcript, preview: image.preview, dimensions: image.dimensions,
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
    if (input.mode === 'meeting') throw new Error('Use the meeting transcript to generate meeting notes.');
    const revision = requestRevision, capturedContext = context;
    if (context.imageMode !== settings.value.sendImage) throw new Error('Capture again after changing image/text mode.');
    await checkProvider();
    if (revision !== requestRevision || capturedContext !== context) throw new Error('Request canceled.');
    // Runs asynchronously; answer events are scoped by the coordinator request ID.
    void coordinator.ask({ question, mode: input.mode, context: { ...context }, model: settings.value.model });
    return { accepted: true };
  });
  handle('fd:cancel', () => { cancel(); return true; });
  handle('fd:clear', () => { cancel(); meeting.clear(); coordinator.clear(); context = null; return true; });
  handle('fd:copy', value => { clipboard.writeText(text(value, 'Answer', 24000)); return true; });
  handle('fd:export', async value => {
    const content = text(value, 'Export', 30000);
    const chosen = await dialog.showSaveDialog(panel, { title: 'Export selected answer', defaultPath: 'float-dot-note.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (chosen.canceled) return false;
    await fs.writeFile(chosen.filePath, content, 'utf8'); return true;
  });
  handle('fd:collapse', () => { panel.hide(); dot.showInactive(); return true; });
  handle('fd:expand', () => { dot.hide(); panel.show(); return true; });
  handle('fd:minimize', () => { if (panel && !panel.isDestroyed()) panel.minimize(); return true; });
  handle('fd:close', () => { cancel(); quitting = true; app.quit(); return true; });
  handle('fd:meeting:start', async input => { coordinator.clear(); return meeting.start(input); });
  handle('fd:meeting:chunk', async input => meeting.addAudioChunk(input?.audio, input?.offsetSec || 0));
  handle('fd:meeting:pause', () => meeting.pause());
  handle('fd:meeting:resume', () => meeting.resume());
  handle('fd:meeting:stop', () => meeting.stop());
  handle('fd:meeting:clear', () => { meeting.clear(); return true; });
  handle('fd:meeting:delete-segment', input => meeting.deleteSegment(input?.id));
  handle('fd:meeting:summarize', async input => {
    const revision = requestRevision, capturedSession = meeting.session;
    await checkProvider();
    if (revision !== requestRevision || capturedSession !== meeting.session) throw new Error('Request canceled.');
    coordinator.cancel();
    return meeting.summarize({ model: settings.value.model, customPrompt: input?.prompt == null ? undefined : text(input.prompt, 'Summary focus') });
  });
  handle('fd:meeting:export', async input => {
    const md = meeting.exportMarkdown(input?.summary ? text(input.summary, 'Summary', 24000) : '');
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
  const width = 480;
  const height = Math.min(800, bounds.height - 40);
  const x = Math.max(bounds.x + 10, bounds.x + bounds.width - width - 24);
  const y = Math.max(bounds.y + 10, bounds.y + 24);

  panel = new BrowserWindow({
    width, height, minWidth: 380, minHeight: 460,
    x, y, title: 'Float Dot', show: !smoke, alwaysOnTop: true,
    frame: false, transparent: true, hasShadow: false, thickFrame: false, autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(root, 'src/preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  panel.setAlwaysOnTop(true);
  panel.setVisibleOnAllWorkspaces(true);

  dot = new BrowserWindow({ width: 84, height: 84, x: bounds.x + bounds.width - 104, y: bounds.y + bounds.height - 124,
    title: 'Float Dot · voice', frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, show: false,
    backgroundColor: '#00000000', hasShadow: false,
    webPreferences: { preload: path.join(root, 'src/preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  dot.setAlwaysOnTop(true);
  dot.setVisibleOnAllWorkspaces(true);

  for (const win of [panel, dot]) {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
  }
  panel.on('close', () => { cancel(); quitting = true; app.quit(); });
  panel.loadURL('floatdot://app/index.html');
  dot.loadURL('floatdot://app/index.html#dot');

  const showPanel = () => {
    if (!smoke && panel && !panel.isDestroyed()) {
      if (panel.isMinimized()) panel.restore();
      panel.show();
      panel.focus();
      panel.setAlwaysOnTop(true);
    }
  };
  panel.once('ready-to-show', showPanel);
  panel.webContents.once('did-finish-load', showPanel);
  setTimeout(showPanel, 600);

  screen.on('display-removed', () => {
    const area = screen.getPrimaryDisplay().workArea;
    panel.setPosition(area.x + 20, area.y + 20); dot.setPosition(area.x + area.width - 104, area.y + area.height - 124);
  });
  try { registerHotkey(settings.value.hotkey); } catch (error) { shortcutError = error.message; }
  const trayPixels = Buffer.from(Array.from({ length: 16 * 16 }, () => [44, 76, 166, 255]).flat());
  tray = new Tray(nativeImage.createFromBitmap(trayPixels, { width: 16, height: 16 }));
  tray.setToolTip('Float Dot');
  const show = () => {
    if (panel.isMinimized()) panel.restore();
    dot.hide();
    panel.show();
    panel.focus();
    panel.setAlwaysOnTop(true);
  };
  tray.on('click', show);
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Float Dot', click: show }, { label: 'Quit', click: () => app.quit() }]));
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
    await new Promise(resolve => setTimeout(resolve, 2500));
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
  if (!captureResult.ok || !/two sum/i.test(captureResult.value?.text || '')) throw new Error(`Native capture/OCR smoke failed: ${captureResult.error || 'missing text'}`);
  console.log('WINDOW_CAPTURE_OCR_SMOKE_OK', JSON.stringify({ confidence: captureResult.value.confidence, chars: captureResult.value.text.length, syntheticOnly: true }));
  const originalSettings = { ...settings.value };
  let received = null;
  const server = require('node:http').createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    received = JSON.parse(body);
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end('data: ' + JSON.stringify({ choices: [{ delta: { content: 'This screenshot shows a Two Sum practice problem.' }, finish_reason: null }] }) + '\n\ndata: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await settings.update({ provider: 'compatible', baseURL: `http://127.0.0.1:${server.address().port}/v1`, model: 'synthetic-vision', sendImage: true });
    const result = await panel.webContents.executeJavaScript(`(async () => {
      const capture = await window.floatDot.prepare(${JSON.stringify({ sourceId: selected.id })});
      if (!capture.ok) throw new Error(capture.error);
      if (capture.value.image) throw new Error('Full image should stay in main-process context.');
      return new Promise((resolve, reject) => {
        let answer = '';
        const timer = setTimeout(() => { unsubscribe(); reject(new Error('Provider smoke timed out')); }, 10000);
        const unsubscribe = window.floatDot.onAnswer(event => {
          if (event.type === 'delta') answer += event.delta;
          if (event.type === 'done' || event.type === 'error') { clearTimeout(timer); unsubscribe(); event.type === 'done' ? resolve(answer) : reject(new Error(event.message)); }
        });
        window.floatDot.ask({ question: capture.value.transcript, contextId: capture.value.id, mode: 'general' }).then(result => {
          if (!result.ok) { clearTimeout(timer); unsubscribe(); reject(new Error(result.error)); }
        });
      });
    })()`);
    if (!/Two Sum/.test(result) || !received?.messages?.at(-1)?.content?.some(part => part.type === 'image_url')) throw new Error('Provider image handoff smoke failed.');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS key encryption unavailable in desktop smoke.');
    await credentials.set({ provider: 'openai' }, 'synthetic-smoke-key');
    if (credentials.get({ provider: 'openai' }) !== 'synthetic-smoke-key') throw new Error('OS key roundtrip failed.');
    await credentials.set({ provider: 'openai' }, '');
    console.log('PROVIDER_IMAGE_SMOKE_OK', JSON.stringify({ endpoint: 'loopback test server', paidAPICalled: false, osEncryption: true }));
  } finally {
    target.destroy(); await settings.update(originalSettings);
    await new Promise(resolve => server.close(resolve));
  }
  console.log('ELECTRON_SMOKE_OK', JSON.stringify(info));
  app.exit(0);
}
const single = app.requestSingleInstanceLock();
if (!single && !smoke) app.quit();
else app.whenReady().then(async () => {
  if (path.dirname(path.resolve(temp)) !== path.resolve(app.getPath('userData'))) throw new Error('Invalid temporary-media directory.');
  await fs.rm(temp, { recursive: true, force: true }); // verified app-owned child directory only
  await settings.load(); await credentials.load(); configureSession(); installIPC(); createWindows();
  if (smoke) await smokeTest();
}).catch(error => { console.error(error.message); app.exit(1); });
app.on('second-instance', () => {
  if (panel) {
    if (panel.isMinimized()) panel.restore();
    dot.hide();
    panel.show();
    panel.focus();
    panel.setAlwaysOnTop(true);
  }
});
app.on('before-quit', () => { if (!quitting) { quitting = true; cancel(); } globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => app.quit());
