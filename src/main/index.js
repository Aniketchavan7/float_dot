const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, session, protocol, clipboard, dialog, Tray, Menu, nativeImage, safeStorage, powerMonitor } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { WindowManager, ShortcutManager } = require('./window-manager');
const { RegionSelector } = require('./region-selector');
const { CaptureService } = require('../services/capture');
const { SettingsStore } = require('../services/settings');
const { CredentialStore } = require('../services/credentials');
const { streamProvider, testConnection, LABELS } = require('../services/providers');
const { inspectModel, validateModelSelection } = require('../services/capabilities');
const { OcrService } = require('../services/ocr');
const { TranscriptionService } = require('../services/transcription');
const { listModels } = require('../services/model');
const { Coordinator } = require('../services/coordinator');
const { MeetingService } = require('../services/meeting');
const { text, MODES, validateAudio, validateSettings } = require('../shared/validation');

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
let windowManager, captureService, regionSelector, shortcutManager;
let tray, registeredHotkey = null, shortcutError = null;
function registerHotkey(value) {
  try { shortcutManager.replace(value); registeredHotkey = value; shortcutError = null; }
  catch (error) { shortcutError = error.message; throw error; }
}
const infer = input => {
  const config = input.snapshot || { ...settings.value, apiKey: credentials.get(settings.value) };
  return streamProvider({
    ...input,
    provider: config.provider,
    baseURL: config.baseURL,
    apiKey: config.apiKey !== undefined ? config.apiKey : credentials.get(config),
    reasoning: config.reasoning,
    image: config.sendImage ? input.image : undefined
  });
};
async function checkProvider() {
  validateModelSelection(settings.value.provider, settings.value.model, { sendImage: settings.value.sendImage });
  if (settings.value.provider === 'ollama') {
    if (!(await listModels()).some(model => model.name === settings.value.model)) throw new Error('Download or choose an installed Ollama model.');
  } else if (settings.value.provider === 'compatible') {
    if (!settings.value.baseURL) throw new Error('Set the compatible API base URL in AI settings.');
  } else if (!credentials.get(settings.value)) throw new Error('Save your API key in AI settings.');
}
async function checkImageSupport(signal) {
  if (settings.value.provider !== 'ollama') return; // Unknown cloud model capability is left to the selected API, never guessed from its name.
  const response = await fetch('http://127.0.0.1:11434/api/show', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:settings.value.model}),signal:AbortSignal.any([signal,AbortSignal.timeout(4000)]),redirect:'error'});
  if (!response.ok) throw new Error('Cannot inspect the local model. Start Ollama and choose an installed model.');
  const info = await response.json();
  if (Array.isArray(info.capabilities) && !info.capabilities.includes('vision')) throw new Error('This Ollama model does not support screenshots. Switch off image mode to use OCR text, or select a vision model.');
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
function ownSource(source) {
  return [panel, dot].some(win => {
    if (!win || win.isDestroyed()) return false;
    const handle = win.getNativeWindowHandle();
    const id = handle.length >= 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString();
    return source.id.split(':')[1] === id || source.name === 'Float Dot' || source.name === 'Float Dot · voice';
  });
}
async function status() {
  let models = [], modelError = null;
  if (settings.value.provider === 'ollama') {
    try { models = await listModels(); } catch { modelError = 'Start Ollama to use local models.'; }
  }
  let keySaved = false;
  try { keySaved = !!credentials.get(settings.value); } catch (error) { modelError = error.message; }
  const capabilities = inspectModel(settings.value.provider, settings.value.model);
  return { settings: settings.value, models, modelError, ocrReady: ocr.ready(), speechReady: await speech.ready(),
    keySaved, providerLabel: LABELS[settings.value.provider], shortcut: settings.value.hotkey, shortcutError, offlineVerified: false, recoveredSettings: !!settings.recovered, capabilities };
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
  handle('fd:provider:test-connection', async input => {
    const provider = input?.provider || settings.value.provider;
    const model = input?.model || settings.value.model;
    const endpoint = input?.baseURL !== undefined ? input.baseURL : settings.value.baseURL;
    const key = input?.key !== undefined ? input.key : credentials.get({ provider, baseURL: endpoint });
    return testConnection({ provider, model, baseURL: endpoint, apiKey: key });
  });
  handle('fd:provider:inspect-model', async input => {
    return inspectModel(input?.provider || settings.value.provider, input?.model || settings.value.model);
  });
  handle('fd:windows', () => captureService.list());
  handle('fd:prepare', async input => {
    if (!input || typeof input !== 'object') throw new Error('Invalid capture request.');
    const question = input.audio ? null : text(input.question || 'Explain what is visible in this screenshot.', 'Question');
    const audio = input.audio ? validateAudio(input.audio) : null;
    cancel(); context = null;
    const job = { id: randomUUID(), controller: new AbortController(), capturedAt: new Date().toISOString() };
    preparation = job;
    const timer = setTimeout(() => job.controller.abort(), 120000);
    try {
      if (input.region !== undefined && typeof input.region !== 'boolean') throw new Error('Invalid region selection.');
      if (settings.value.sendImage) await checkImageSupport(job.controller.signal);
      const image = input.openScreenshot === true || input.openScreenshot === 'clipboard'
        ? await captureService.importImage(input.openScreenshot, job.controller.signal)
        : await captureService.capture(input, job.controller.signal);
      if (!image) return null;
      if (image.buffer.length > 20 * 1024 * 1024) throw new Error('Screenshot is too large. Choose a smaller image.');
      job.controller.signal.throwIfAborted();
      const transcript = audio ? await speech.transcribe(audio, job.controller.signal) : question;
      const extraction = settings.value.sendImage ? { text: '[Screenshot supplied as image. Read visible content directly; identify unreadable details.]', confidence: 100, truncated: false }
        : await ocr.read(image.buffer, job.controller.signal);
      job.controller.signal.throwIfAborted();
      if (preparation !== job) throw new Error('Capture replaced by a newer request.');
      context = { id: job.id, sourceId: input.openScreenshot ? `screenshot:${job.id}` : image.sourceId, capturedAt: job.capturedAt, name: image.name, text: extraction.text,
        quality: { confidence: extraction.confidence, truncated: extraction.truncated }, image: image.buffer.toString('base64'), imageMode: settings.value.sendImage };
      const { image: _image, ...publicContext } = context;
      return { ...publicContext, transcript, preview: image.preview, dimensions: image.dimensions,
        confidence: extraction.confidence, truncated: extraction.truncated, crop: image.crop || null };
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
    const currentConfig = { ...settings.value };
    const snapshot = {
      provider: currentConfig.provider,
      model: currentConfig.model,
      baseURL: currentConfig.baseURL,
      apiKey: credentials.get(currentConfig),
      reasoning: currentConfig.reasoning,
      sendImage: currentConfig.sendImage
    };
    // Runs asynchronously; answer events are scoped by the coordinator request ID.
    void coordinator.ask({ question, mode: input.mode, context: { ...context }, model: snapshot.model, snapshot });
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
  handle('fd:collapse', () => { cancel(); windowManager.collapse(); return true; });
  handle('fd:expand', () => { windowManager.show(); return true; });
  handle('fd:focus', () => { windowManager.show({ focus:true }); return true; });
  handle('fd:layout', input => windowManager.layout(input || {}));
  handle('fd:pin', value => windowManager.setPinned(value));
  handle('fd:hide', () => { cancel(); windowManager.hide(); return true; });
  handle('fd:minimize', () => { cancel(); windowManager.hide(); return true; });
  handle('fd:close', () => { cancel(); app.quit(); return true; });
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
  handle('fd:export-diagnostics', async () => {
    const os = require('node:os');
    const diag = {
      app: { version: app.getVersion(), name: app.getName() },
      system: { platform: os.platform(), release: os.release(), arch: os.arch(), totalMemMB: Math.round(os.totalmem() / (1024 * 1024)) },
      provider: {
        choice: settings.value.provider,
        model: settings.value.model,
        hasCustomBaseURL: !!settings.value.baseURL,
        sendImage: settings.value.sendImage,
        reasoning: settings.value.reasoning,
        hasSavedKey: !!credentials.get(settings.value)
      },
      displays: screen.getAllDisplays().map(d => ({ bounds: d.bounds, scaleFactor: d.scaleFactor })),
      sanitization: 'Keys, screen content, transcripts, and image buffers are strictly excluded from diagnostics.'
    };
    const content = JSON.stringify(diag, null, 2);
    const chosen = await dialog.showSaveDialog(panel, {
      title: 'Export Sanitized Diagnostics',
      defaultPath: 'float-dot-diagnostics.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (chosen.canceled) return false;
    await fs.writeFile(chosen.filePath, content, 'utf8');
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
    ['/region.html', path.join(root, 'src/renderer/region.html')],
    ['/region.js', path.join(root, 'src/renderer/region.js')],
    ['/region.css', path.join(root, 'src/renderer/region.css')],
    ['/app.js', path.join(root, 'src/renderer/app.js')],
    ['/overlay.js', path.join(root, 'src/renderer/overlay.js')],
    ['/answer-view.js', path.join(root, 'src/renderer/answer-view.js')],
    ['/audio-worklet.js', path.join(root, 'src/renderer/audio-worklet.js')],
    ['/audio.js', path.join(root, 'src/renderer/audio.js')],
    ['/voice-controller.js', path.join(root, 'src/renderer/voice-controller.js')],
    ['/settings-view.js', path.join(root, 'src/renderer/settings-view.js')],
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
  const webPreferences = { preload:path.join(root, 'src/preload/index.js'), nodeIntegration:false, contextIsolation:true, sandbox:true };
  panel = new BrowserWindow({ ...windowManager.initial('panel'), minWidth:320, minHeight:48, title:'Float Dot', show:false,
    alwaysOnTop:true, frame:false, transparent:true, hasShadow:false, thickFrame:false, resizable:false, skipTaskbar:true,
    backgroundColor:'#00000000', webPreferences });
  dot = new BrowserWindow({ ...windowManager.initial('dot'), title:'Float Dot · voice', show:false,
    alwaysOnTop:true, frame:false, transparent:true, hasShadow:false, resizable:false, skipTaskbar:true,
    backgroundColor:'#00000000', webPreferences });
  windowManager.attach(panel,dot);
  for (const win of [panel,dot]) {
    win.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.on('close', event => { if (!quitting) { event.preventDefault(); cancel(); windowManager.collapse(); } });
  }
  let crashes = 0;
  panel.webContents.on('render-process-gone', () => {
    cancel(); context=null; coordinator.clear();
    if (++crashes <= 2) panel.webContents.reload();
    else { windowManager.needsReload = true; windowManager.collapse(); }
  });
  panel.once('ready-to-show', () => { if (!smoke) windowManager.show(); });
  panel.loadURL('floatdot://app/index.html');
  dot.loadURL('floatdot://app/index.html#dot');
  for (const event of ['display-removed','display-added','display-metrics-changed']) screen.on(event, () => { regionSelector.cancel(); windowManager.recover(); });
  powerMonitor.on('suspend', () => { cancel(); regionSelector.cancel(); });
  powerMonitor.on('resume', () => windowManager.recover());
  shortcutManager = new ShortcutManager(globalShortcut, () => { windowManager.show(); panel.webContents.send('fd:hotkey'); });
  try { registerHotkey(settings.value.hotkey); } catch {}
  const trayPixels = Buffer.from(Array.from({ length:16*16 }, () => [44,76,166,255]).flat());
  tray = new Tray(nativeImage.createFromBitmap(trayPixels,{width:16,height:16}));
  tray.setToolTip('Float Dot');
  tray.on('click', () => windowManager.show());
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Show Float Dot',click:() => windowManager.show()},
    {label:'Open for typing',click:() => windowManager.show({focus:true})},
    {label:'Collapse to dot',click:() => { cancel(); windowManager.collapse(); }},
    {label:'Hide',click:() => { cancel(); windowManager.hide(); }},
    {label:'Quit',click:() => app.quit()}
  ]));
  captureService = new CaptureService({desktopCapturer,screen,nativeImage,clipboard,dialog,panel:() => panel,ownSource,windows:windowManager,selector:regionSelector});
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
  await require('../../scripts/desktop-modules-smoke.cjs')({panel,target,windowManager,regionSelector,screen,nativeImage,fixture,root});
  const nativeHandle = target.getNativeWindowHandle();
  const nativeId = nativeHandle.length >= 8 ? nativeHandle.readBigUInt64LE().toString() : nativeHandle.readUInt32LE().toString();
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1, height: 1 } });
  const selected = sources.find(source => source.id.split(':')[1] === nativeId);
  if (!selected) throw new Error('Synthetic test window not available to desktop capture.');
  const captureResult = await panel.webContents.executeJavaScript(`window.floatDot.prepare(${JSON.stringify({ sourceId: selected.id, question: 'Give me one hint without the solution.' })})`);
  if (!captureResult.ok || !/two sum/i.test(captureResult.value?.text || '')) throw new Error(`Native capture/OCR smoke failed: ${captureResult.error || 'missing text'}`);
  console.log('WINDOW_CAPTURE_OCR_SMOKE_OK', JSON.stringify({ confidence: captureResult.value.confidence, chars: captureResult.value.text.length, syntheticOnly: true }));
  const review = await panel.webContents.executeJavaScript(`(async () => {
    const source=document.querySelector('#source');
    source.add(new Option('Synthetic fixture',${JSON.stringify(selected.id)})); source.value=${JSON.stringify(selected.id)};
    const confirm=document.querySelector('#confirm-capture');confirm.checked=true;confirm.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve,200));document.querySelector('#capture').click();
    for(let i=0;i<150;i++) {
      await new Promise(resolve=>setTimeout(resolve,100));
      if(!document.querySelector('#capture-review').hidden) return {visible:document.querySelector('#preview').getBoundingClientRect().height>0,evidence:document.querySelector('#extracted').textContent.includes('Two Sum')};
    }
    throw new Error('Capture review did not appear');
  })()`);
  if (!review.visible || !review.evidence) throw new Error('Capture preview/evidence hidden before confirmation');
  await new Promise(resolve=>setTimeout(resolve,200));
  await fs.writeFile(path.join(root,'.artifacts/review-smoke.png'),(await panel.webContents.capturePage()).toPNG());
  await panel.webContents.executeJavaScript(`document.querySelector('#discard').click()`);
  console.log('CAPTURE_REVIEW_SMOKE_OK',JSON.stringify(review));
  const originalSettings = { ...settings.value };
  let received = null;
  const server = require('node:http').createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    received = JSON.parse(body);
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const mockAnswer = '### Answer\nThis screenshot shows a Two Sum practice problem.\n\n### Screen evidence\n| Input | Target |\n| --- | --- |\n| 2, 7, 11, 15 | 9 |\n\n### Next step\nCheck the sum.\n\n```js\n2 + 7 === 9\n```\n<img src=x onerror="window.unsafeAnswer=true">';
    response.end('data: ' + JSON.stringify({ choices: [{ delta: { content: mockAnswer }, finish_reason: null }] }) + '\n\ndata: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
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
    const rendered = await panel.webContents.executeJavaScript(`(() => {
      document.querySelector('#answer-section').hidden = false;
      document.querySelector('#empty').hidden = true;
      return { headings: document.querySelectorAll('#answer h3').length, table: !!document.querySelector('#answer table'), code: !!document.querySelector('#answer pre code'), complete: document.querySelector('#answer-state').dataset.complete, unsafe: !!window.unsafeAnswer || !!document.querySelector('#answer img'), copyDisabled: document.querySelector('#copy').disabled };
    })()`);
    if (rendered.headings !== 3 || !rendered.table || !rendered.code || rendered.complete !== 'true' || rendered.unsafe || rendered.copyDisabled) throw new Error(`Answer rendering failed: ${JSON.stringify(rendered)}`);
    panel.showInactive();
    await new Promise(resolve => setTimeout(resolve, 250));
    await fs.writeFile(path.join(root, '.artifacts/answer-smoke.png'), (await panel.webContents.capturePage()).toPNG());
    console.log('STRUCTURED_ANSWER_SMOKE_OK', JSON.stringify(rendered));
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS key encryption unavailable in desktop smoke.');
    await credentials.set({ provider: 'openai' }, 'synthetic-smoke-key');
    if (credentials.get({ provider: 'openai' }) !== 'synthetic-smoke-key') throw new Error('OS key roundtrip failed.');
    await credentials.set({ provider: 'openai' }, '');
    console.log('PROVIDER_IMAGE_SMOKE_OK', JSON.stringify({ endpoint: 'loopback test server', paidAPICalled: false, osEncryption: true }));
    await require('../../scripts/voice-smoke.cjs')({panel,speech,getReceived:()=>received});
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
  await settings.load(); await credentials.load();
  windowManager = new WindowManager({screen,directory:app.getPath('userData'),reportError:message => console.error(message)});
  await windowManager.load();
  regionSelector = new RegionSelector({BrowserWindow,ipcMain,preload:path.join(root,'src/preload/region.js')});
  configureSession(); installIPC(); createWindows();
  if (smoke) await smokeTest();
}).catch(error => { console.error(error.message); app.exit(1); });
app.on('second-instance', () => windowManager?.show());
let flushed = false;
app.on('before-quit', event => {
  if (!quitting) { quitting = true; cancel(); regionSelector?.cancel(); }
  globalShortcut.unregisterAll();
  if (!flushed && windowManager) { event.preventDefault(); flushed = true; windowManager.save().finally(() => app.quit()); }
});
app.on('window-all-closed', () => app.quit());
