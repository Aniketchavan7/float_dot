const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { clampBounds, ShortcutManager, WindowManager } = require('../src/main/window-manager');
const { CaptureService, regionToPixels, packImage } = require('../src/services/capture');
const display = { id:1, bounds:{x:0,y:0,width:1920,height:1080}, workArea:{x:0,y:0,width:1920,height:1040} };
test('window placement clamps to negative-coordinate monitors and recovers after disconnect', () => {
  const left = {id:2,workArea:{x:-1280,y:0,width:1280,height:984}};
  const original = {x:-1200,y:950,width:440,height:500};
  assert.deepEqual(clampBounds(original,[display,left]),{x:-1200,y:484,width:440,height:500});
  assert.deepEqual(clampBounds(original,[display]),{x:0,y:540,width:440,height:500});
  assert.deepEqual(clampBounds({x:0,y:0,width:4000,height:4000},[display]),{x:0,y:0,width:1920,height:1040});
});
test('shortcut conflict or thrown registration keeps old shortcut registered', () => {
  const active = new Set();
  const m = new ShortcutManager({register(key) {if(key==='conflict')return false;if(key==='invalid')throw Error('Invalid');active.add(key);return true;},unregister:key=>active.delete(key)},()=>{});
  m.replace('old'); assert.throws(()=>m.replace('conflict'));assert.throws(()=>m.replace('invalid'));
  assert.deepEqual([...active],['old']);m.replace('new');assert.deepEqual([...active],['new']);
});
class FakeWindow extends EventEmitter {
  constructor() { super(); this.visible=true;this.focusCount=0;this.bounds={x:1800,y:900,width:440,height:70};this.webContents={send(){}}; }
  isVisible(){return this.visible;} isDestroyed(){return false;} hide(){this.visible=false;} showInactive(){this.visible=true;} show(){this.visible=true;this.focusCount++;} focus(){this.focusCount++;}
  getBounds(){return this.bounds;} setBounds(b){this.bounds={...this.bounds,...b};} setAlwaysOnTop(){}
}
function windowManager() {
  const m = new WindowManager({directory:'.artifacts',screen:{getPrimaryDisplay:()=>display,getAllDisplays:()=>[display],getDisplayMatching:()=>display}});
  m.scheduleSave=()=>{};m.attach(new FakeWindow(),new FakeWindow());m.dot.hide();return m;
}
test('passive show, capture restore and 100 collapse cycles never focus the panel', () => {
  const m=windowManager();
  for(let i=0;i<100;i++){m.collapse();m.show();const restore=m.suspend();restore();}
  assert.equal(m.panel.focusCount,0);assert.equal(m.panel.visible,true);assert.equal(m.dot.visible,false);
  m.show({focus:true});assert.ok(m.panel.focusCount>0);
});
test('capture restore does not override a later hide or collapse', () => {
  const m=windowManager();const restore=m.suspend();m.hide();restore();assert.equal(m.panel.visible,false);assert.equal(m.dot.visible,false);
  m.show();const second=m.suspend();m.collapse();second();assert.equal(m.panel.visible,false);assert.equal(m.dot.visible,true);
});
test('native panel grows to content, clamps to work area, then shrinks to toolbar', () => {
  const m=windowManager();m.layout({height:800});assert.equal(m.panel.bounds.height,800);assert.equal(m.panel.bounds.y,240);
  m.layout({height:62});assert.equal(m.panel.bounds.height,70);assert.throws(()=>m.layout({height:NaN}));
});
test('region mapping uses actual bitmap dimensions at 100, 125, 150 and 200 percent', () => {
  for(const scale of [1,1.25,1.5,2]) {
    assert.deepEqual(regionToPixels({x:100,y:80,width:200,height:160},{width:1920,height:1080},{width:1920*scale,height:1080*scale}),{x:100*scale,y:80*scale,width:200*scale,height:160*scale});
  }
  assert.throws(()=>regionToPixels({x:-1,y:0,width:100,height:100},display.bounds,{width:1920,height:1080}));
  assert.throws(()=>regionToPixels({x:1800,y:0,width:200,height:100},display.bounds,{width:1920,height:1080}));
});
function bitmap(width=1920,height=1080) {
  return {isEmpty:()=>false,getSize:()=>({width,height}),toPNG:()=>Buffer.from('PNG'),toDataURL:()=> 'data:image/png;base64,UE5H',resize:size=>bitmap(size.width,size.height||Math.round(height*size.width/width)),crop:r=>bitmap(r.width,r.height)};
}
function captureService({sources, selector = {select:async()=>null}, getSources}={}) {
  let restored=0,hidden=0;
  const service=new CaptureService({desktopCapturer:{getSources:getSources||(async()=>sources||[{id:'screen:1:0',display_id:'1',name:'Display',thumbnail:bitmap()}])},screen:{getPrimaryDisplay:()=>display,getAllDisplays:()=>[display]},ownSource:()=>false,windows:{suspend:()=>{hidden++;return()=>restored++;}},selector,delay:async()=>{}});
  return {service,counts:()=>({restored,hidden})};
}
test('explicit missing source fails instead of falling back and always restores overlay', async () => {
  const {service,counts}=captureService();await assert.rejects(service.capture({sourceId:'screen:missing'},new AbortController().signal),/unavailable/);
  assert.deepEqual(counts(),{hidden:1,restored:1});
});
test('region cancel returns no capture; region success preserves source ID and pixel crop', async () => {
  const {service,counts}=captureService();assert.equal(await service.capture({region:true},new AbortController().signal),null);assert.equal(counts().restored,1);
  service.selector={select:async()=>({x:100,y:80,width:200,height:160})};
  const capture=await service.capture({region:true},new AbortController().signal);assert.equal(capture.sourceId,'screen:1:0');assert.deepEqual(capture.dimensions,{width:200,height:160});
});
test('cancel during native capture restores windows and suppresses the result', async () => {
  const controller=new AbortController();const {service,counts}=captureService({getSources:async()=>{controller.abort();return[];}});
  await assert.rejects(service.capture({},controller.signal),{name:'AbortError'});assert.equal(counts().restored,1);
});
test('malformed images are rejected and large imports preserve aspect ratio within bounds', () => {
  assert.throws(()=>packImage({isEmpty:()=>true},'bad'),/could not/);
  assert.throws(()=>packImage(bitmap(20000,20000),'huge'),/resolution/);
  assert.deepEqual(packImage(bitmap(8000,4000),'large').dimensions,{width:4096,height:2048});
});

test('window placement and pin state survive disk reload and clamp after monitor removal', async () => {
  const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'float-dot-placement-'));
  try {
    const screen={getPrimaryDisplay:()=>display,getAllDisplays:()=>[display]};
    const first=new WindowManager({screen,directory});
    first.state={panel:{x:-1100,y:10,width:440,height:700},dot:{x:-100,y:30,width:56,height:56}};first.pinned=false;
    await first.save();
    const next=new WindowManager({screen,directory});await next.load();
    assert.equal(next.pinned,false);assert.equal(next.initial('panel').x,0);assert.equal(next.initial('panel').height,70);assert.equal(next.initial('dot').x,0);
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});

test('queued capture canceled before starting cannot hide or restore a later capture', async () => {
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const {service,counts}=captureService({getSources:async()=>{await gate;return[{id:'screen:1:0',display_id:'1',name:'Display',thumbnail:bitmap()}];}});
  const first=service.capture({},new AbortController().signal);
  const controller=new AbortController();const second=service.capture({},controller.signal);
  controller.abort();release();await first;await assert.rejects(second,{name:'AbortError'});
  assert.deepEqual(counts(),{hidden:1,restored:1});
});
