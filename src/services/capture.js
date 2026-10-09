const fs = require('node:fs/promises');
const path = require('node:path');
const { validateCrop } = require('../shared/validation');
const MAX_BYTES = 20 * 1024 * 1024;
function regionToPixels(region, displaySize, imageSize) {
  const { x,y,width,height } = region || {};
  if (![x,y,width,height].every(Number.isFinite) || x < 0 || y < 0 || width < 2 || height < 2 || x + width > displaySize.width + 1 || y + height > displaySize.height + 1) throw new Error('Select a region inside one display.');
  const left = Math.floor(x * imageSize.width / displaySize.width), top = Math.floor(y * imageSize.height / displaySize.height);
  const right = Math.min(imageSize.width, Math.ceil((x + width) * imageSize.width / displaySize.width));
  const bottom = Math.min(imageSize.height, Math.ceil((y + height) * imageSize.height / displaySize.height));
  return validateCrop({ x:left,y:top,width:right-left,height:bottom-top }, imageSize);
}
function packImage(bitmap, name, sourceId, extra = {}) {
  if (!bitmap || bitmap.isEmpty()) throw new Error('Screenshot could not be read. Choose a PNG or JPEG image.');
  const size = bitmap.getSize();
  if (size.width * size.height > 64 * 1024 * 1024) throw new Error('Screenshot resolution is too large.');
  const scale = Math.min(1, 4096 / Math.max(size.width,size.height));
  if (scale < 1) bitmap = bitmap.resize({ width:Math.round(size.width * scale),height:Math.round(size.height * scale) });
  const buffer = bitmap.toPNG();
  if (buffer.length > MAX_BYTES) throw new Error('Screenshot is too large. Choose a smaller region.');
  return { buffer, preview:bitmap.resize({ width:Math.min(640,bitmap.getSize().width) }).toDataURL(), dimensions:bitmap.getSize(), name, sourceId, ...extra };
}
class CaptureService {
  constructor({ desktopCapturer, screen, nativeImage, clipboard, dialog, panel, ownSource, windows, selector, delay = ms => new Promise(r => setTimeout(r,ms)) }) {
    Object.assign(this,{desktopCapturer,screen,nativeImage,clipboard,dialog,panel,ownSource,windows,selector,delay}); this.queue = Promise.resolve();
  }
  async list() {
    const sources = await this.desktopCapturer.getSources({ types:['screen','window'],thumbnailSize:{width:0,height:0} });
    const displays = this.screen.getAllDisplays();
    return sources.filter(s => !this.ownSource(s) && s.name?.trim()).map(s => {
      const d = displays.find(d => String(d.id) === s.display_id);
      return { id:s.id, name:s.id.startsWith('screen:') ? `${d?.label || 'Display'}${d ? ` ${displays.indexOf(d)+1} · ${d.bounds.width}×${d.bounds.height}` : ''}${d?.id === this.screen.getPrimaryDisplay().id ? ' · Primary' : ''}` : s.name, displayId:d?.id };
    });
  }
  async importImage(input, signal) {
    signal.throwIfAborted();
    let bitmap, name;
    if (input === 'clipboard') { bitmap = this.clipboard.readImage(); name = 'Clipboard screenshot'; }
    else {
      const chosen = await this.dialog.showOpenDialog(this.panel(), { title:'Open a screenshot',properties:['openFile'],filters:[{name:'Screenshots',extensions:['png','jpg','jpeg','webp']}] });
      signal.throwIfAborted();
      if (chosen.canceled) return null;
      const file = chosen.filePaths[0];
      if ((await fs.stat(file)).size > MAX_BYTES) throw new Error('Choose a screenshot smaller than 20 MB.');
      bitmap = this.nativeImage.createFromBuffer(await fs.readFile(file)); name = path.basename(file);
    }
    signal.throwIfAborted();
    return packImage(bitmap,name,null);
  }
  capture(input, signal) {
    const operation = this.queue.catch(() => {}).then(() => this.captureNow(input,signal));
    this.queue = operation.catch(() => {}); return operation;
  }
  async captureNow({ sourceId = 'screen:default', crop, region = false }, signal) {
    signal.throwIfAborted();
    const defaults = ['screen:default','screen:primary'].includes(sourceId);
    if (typeof sourceId !== 'string' || !/^(window|screen):/.test(sourceId) || sourceId.length > 160) throw new Error('Choose a window or display.');
    if (region && !sourceId.startsWith('screen:')) throw new Error('Choose a display in the source menu before selecting a region.');
    const restore = this.windows.suspend();
    try {
      await this.delay(180); signal.throwIfAborted();
      const sources = await this.desktopCapturer.getSources({ types:[sourceId.startsWith('screen:') ? 'screen' : 'window'],thumbnailSize:{width:4096,height:4096} });
      signal.throwIfAborted();
      const source = defaults ? sources.find(s => s.id.startsWith('screen:') && s.display_id === String(this.screen.getPrimaryDisplay().id)) : sources.find(s => s.id === sourceId);
      if (!source || this.ownSource(source) || source.thumbnail.isEmpty()) throw new Error('Selected screen or window is unavailable. Refresh sources and select it again.');
      let bitmap = source.thumbnail, selectedCrop = crop;
      if (region) {
        const display = this.screen.getAllDisplays().find(d => String(d.id) === source.display_id);
        if (!display) throw new Error('Selected display was disconnected.');
        const selection = await this.selector.select({ display, image:bitmap.toDataURL(), signal });
        signal.throwIfAborted();
        if (!selection) return null;
        selectedCrop = regionToPixels(selection,display.bounds,bitmap.getSize());
      }
      const bounds = validateCrop(selectedCrop,bitmap.getSize());
      if (bounds) bitmap = bitmap.crop(bounds);
      return packImage(bitmap,`${source.name}${region ? ' · Region' : ''}`,source.id,{ crop:bounds || null });
    } finally { restore(); }
  }
}
module.exports = { CaptureService, regionToPixels, packImage };
