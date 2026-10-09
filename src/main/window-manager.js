const fs = require('node:fs/promises');
const path = require('node:path');

function clampBounds(bounds, displays) {
  const overlap = d => Math.max(0, Math.min(bounds.x + bounds.width, d.workArea.x + d.workArea.width) - Math.max(bounds.x, d.workArea.x)) * Math.max(0, Math.min(bounds.y + bounds.height, d.workArea.y + d.workArea.height) - Math.max(bounds.y, d.workArea.y));
  const display = [...displays].sort((a,b) => overlap(b) - overlap(a))[0];
  const area = display.workArea;
  const width = Math.min(Math.max(48, Math.round(bounds.width)), area.width);
  const height = Math.min(Math.max(48, Math.round(bounds.height)), area.height);
  return { x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))), width, height };
}
class ShortcutManager {
  constructor(shortcuts, action) { this.shortcuts = shortcuts; this.action = action; this.current = null; }
  replace(value) {
    if (value === this.current) return;
    // Register first so a conflict cannot remove the working shortcut.
    if (!this.shortcuts.register(value, this.action)) throw new Error('Shortcut is in use. Your previous shortcut is still active.');
    if (this.current) this.shortcuts.unregister(this.current);
    this.current = value;
  }
}
class WindowManager {
  constructor({ screen, directory, reportError = () => {} }) {
    this.screen = screen; this.file = path.join(directory, 'window-state.json'); this.reportError = reportError;
    this.state = {}; this.revision = 0; this.queue = Promise.resolve(); this.pinned = true;
  }
  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      for (const key of ['panel','dot']) if (data[key] && ['x','y','width','height'].every(k => Number.isFinite(data[key][k]))) this.state[key] = data[key];
      this.pinned = data.pinned !== false;
    } catch (error) { if (error.code !== 'ENOENT') this.reportError('Window placement reset.'); }
  }
  initial(key) {
    const a = this.screen.getPrimaryDisplay().workArea;
    const b = this.state[key] || { x:a.x + a.width - 470, y:a.y + 24, width:key === 'dot' ? 56 : 440, height:key === 'dot' ? 56 : 70 };
    return clampBounds({ ...b, width:key === 'dot' ? 56 : Math.max(380, Math.min(b.width, 600)), height:key === 'dot' ? 56 : 70 }, this.screen.getAllDisplays());
  }
  attach(panel, dot) {
    this.panel = panel; this.dot = dot;
    for (const [key,win] of [['panel',panel],['dot',dot]]) {
      win.setAlwaysOnTop(this.pinned);
      win.on('move', () => { this.state[key] = win.getBounds(); this.scheduleSave(); });
    }
  }
  scheduleSave() { clearTimeout(this.timer); this.timer = setTimeout(() => this.save(), 150); }
  save() {
    clearTimeout(this.timer);
    const data = JSON.stringify({ ...this.state, pinned:this.pinned });
    this.queue = this.queue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive:true });
      await fs.writeFile(this.file + '.tmp', data, { mode:0o600 });
      await fs.rename(this.file + '.tmp', this.file);
    }).catch(() => this.reportError('Could not save window placement.'));
    return this.queue;
  }
  show({ focus = false } = {}) {
    this.revision++; this.dot.hide();
    if (this.needsReload) { this.needsReload = false; this.panel.webContents.reload(); }
    this.panel.showInactive();
    if (focus) { this.panel.show(); this.panel.focus(); this.panel.webContents.send('fd:focus-input'); }
  }
  collapse() { this.revision++; this.panel.hide(); this.dot.showInactive(); }
  hide() { this.revision++; this.panel.hide(); this.dot.hide(); }
  setPinned(value) {
    if (typeof value !== 'boolean') throw new Error('Invalid pin value.');
    this.pinned = value; this.panel.setAlwaysOnTop(value); this.dot.setAlwaysOnTop(value); this.scheduleSave(); return value;
  }
  layout({ height }) {
    if (!Number.isFinite(height) || height < 1 || height > 10000) throw new Error('Invalid panel size.');
    const b = this.panel.getBounds();
    const display = this.screen.getDisplayMatching(b);
    const next = clampBounds({ ...b, height:Math.max(70, Math.min(Math.ceil(height), display.workArea.height - 16)) }, this.screen.getAllDisplays());
    // Reapplying unchanged width at fractional DPI can accumulate native rounding.
    const changed = Object.fromEntries(Object.entries(next).filter(([key,value]) => b[key] !== value));
    if (Object.keys(changed).length) this.panel.setBounds(changed, false);
    this.state.panel = { ...next, height:70 }; this.scheduleSave();
    return { workArea:display.workArea, pinned:this.pinned };
  }
  recover() {
    for (const win of [this.panel,this.dot]) if (win && !win.isDestroyed()) win.setBounds(clampBounds(win.getBounds(), this.screen.getAllDisplays()), false);
    this.panel?.webContents.send('fd:display-changed');
  }
  suspend() {
    const revision = this.revision, panel = this.panel.isVisible(), dot = this.dot.isVisible();
    this.panel.hide(); this.dot.hide();
    return () => {
      if (revision !== this.revision) return; // Do not undo a later explicit hide/collapse.
      if (panel && !this.panel.isDestroyed()) this.panel.showInactive();
      if (dot && !this.dot.isDestroyed()) this.dot.showInactive();
    };
  }
}
module.exports = { clampBounds, ShortcutManager, WindowManager };
