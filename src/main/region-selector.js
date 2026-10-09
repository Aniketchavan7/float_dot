class RegionSelector {
  constructor({ BrowserWindow, ipcMain, preload }) {
    this.BrowserWindow = BrowserWindow; this.preload = preload;
    const trusted = event => this.active && event.sender === this.active.win.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === 'floatdot://app/region.html';
    ipcMain.handle('fd:region:data', event => { if (!trusted(event)) throw new Error('Untrusted selection request.'); return this.active.data; });
    ipcMain.handle('fd:region:finish', (event,input) => {
      if (!trusted(event) || input?.id !== this.active.data.id) throw new Error('Expired selection request.');
      this.active.finish(input.region); return true;
    });
  }
  cancel() { this.active?.finish(null); }
  select({ display, image, signal }) {
    this.cancel(); signal.throwIfAborted();
    return new Promise((resolve,reject) => {
      const win = new this.BrowserWindow({ ...display.bounds, show:false, frame:false, transparent:false, backgroundColor:'#12141a', resizable:false, movable:false, skipTaskbar:true, alwaysOnTop:true,
        webPreferences:{preload:this.preload,nodeIntegration:false,contextIsolation:true,sandbox:true} });
      win.setMenuBarVisibility(false);
      win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
      win.webContents.on('will-navigate',event => event.preventDefault());
      let settled = false;
      const finish = (region,error) => {
        if (settled) return; settled = true;
        signal.removeEventListener('abort',abort);
        if (this.active?.win === win) this.active = null;
        if (!win.isDestroyed()) win.destroy();
        if (error) reject(error); else resolve(region || null);
      };
      const abort = () => finish(null, new DOMException('Selection canceled','AbortError'));
      this.active = {win,finish,data:{id:require('node:crypto').randomUUID(),image,width:display.bounds.width,height:display.bounds.height}};
      signal.addEventListener('abort',abort,{once:true});
      win.on('closed',() => finish(null));
      win.webContents.on('render-process-gone',() => finish(null,new Error('Region selector closed unexpectedly. Try again.')));
      win.once('ready-to-show',() => { if (!settled) { win.show(); win.focus(); } });
      win.loadURL('floatdot://app/region.html').catch(error => finish(null,error));
    });
  }
}
module.exports = { RegionSelector };
