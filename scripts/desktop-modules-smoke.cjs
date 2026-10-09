const assert = require('node:assert/strict');
const path = require('node:path');
const { CaptureService } = require('../src/services/capture');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));

module.exports = async ({panel,target,windowManager,regionSelector,screen,nativeImage,fixture,root}) => {
  await panel.webContents.executeJavaScript(`document.querySelector('#settings-close').click(); document.querySelector('#error').hidden=true;`);
  await pause(250);
  const contentHeight=await panel.webContents.executeJavaScript(`document.querySelector('#panel').getBoundingClientRect().height+16`);
  assert.ok(Math.abs(panel.getBounds().height-Math.max(70,contentHeight))<=2,'Native window did not shrink after closing settings');
  await require('node:fs/promises').writeFile(path.join(root,'.artifacts/compact-smoke.png'),(await panel.webContents.capturePage()).toPNG());
  target.show(); target.focus(); await pause(200);
  let focusEvents = 0;
  const initialWidth=panel.getBounds().width;
  const onFocus = () => focusEvents++;
  panel.on('focus',onFocus);
  for (let i=0;i<100;i++) { windowManager.collapse(); windowManager.show(); await pause(10); }
  for (let i=0;i<30;i++) { windowManager.layout({height:70+(i%2)*30}); await pause(10); }
  await panel.webContents.executeJavaScript(`document.querySelector('#answer-section').hidden=false`);
  panel.webContents.send('fd:answer',{type:'started',requestId:'passive-smoke'});
  for (let i=0;i<30;i++) {
    panel.webContents.send('fd:answer',{type:'delta',requestId:'passive-smoke',delta:`Passive answer update ${i}.\n\n`});
    await pause(50);
  }
  panel.webContents.send('fd:answer',{type:'done',requestId:'passive-smoke',answer:'Completed synthetic focus check.',turn:1});
  await panel.webContents.executeJavaScript(`document.querySelector('#clear').click()`);
  await pause(250);
  assert.equal(focusEvents,0,'Passive window operations stole focus');
  assert.ok(target.isFocused(),'Synthetic editor lost focus');
  assert.ok(Math.abs(panel.getBounds().width-initialWidth)<=2,'Content updates drifted native panel width');
  windowManager.layout({height:70});
  const idleHeight=panel.getBounds().height;
  assert.ok(Math.abs(idleHeight-70)<=2,`Idle panel retained an invisible input area: ${idleHeight}`);
  panel.removeListener('focus',onFocus);
  console.log('NATIVE_WINDOW_SMOKE_OK',JSON.stringify({cycles:100,passiveResizes:30,answerUpdates:30,focusEvents,idleHeight,scale:screen.getPrimaryDisplay().scaleFactor}));

  const display = screen.getPrimaryDisplay();
  const select = async (cancel=false) => {
    const selection = regionSelector.select({display,image:fixture,signal:new AbortController().signal});
    const win = regionSelector.active.win;
    await new Promise(resolve => win.webContents.once('did-finish-load',resolve));
    await pause(250);
    // Exercise actual native input and the isolated preload/IPC, using only a synthetic image.
    if (cancel) win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
    else {
      win.webContents.sendInputEvent({type:'mouseMove',x:100,y:100});
      win.webContents.sendInputEvent({type:'mouseDown',x:100,y:100,button:'left',clickCount:1});
      win.webContents.sendInputEvent({type:'mouseMove',x:350,y:250,buttons:['left']});
      win.webContents.sendInputEvent({type:'mouseUp',x:350,y:250,button:'left',clickCount:1});
    }
    let timeout;
    try { return await Promise.race([selection,new Promise((_,reject)=>{timeout=setTimeout(()=>{regionSelector.cancel();reject(Error('Region picker did not settle'));},5000);})]); }
    finally { clearTimeout(timeout); }
  };
  const region = await select();
  assert.ok(region && region.width>=240 && region.height>=140,`Incorrect native selection ${JSON.stringify(region)}`);
  assert.equal(await select(true),null,'Escape did not cancel selection');
  assert.equal(regionSelector.active,null);
  console.log('REGION_PICKER_SMOKE_OK',JSON.stringify({region,escape:true,syntheticOnly:true}));

  const imports = new CaptureService({nativeImage,clipboard:{readImage:()=>nativeImage.createFromDataURL(fixture)},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[path.join(root,'.artifacts/ocr-fixture.png')]})},panel:()=>panel});
  for (const kind of [true,'clipboard']) {
    const image = await imports.importImage(kind,new AbortController().signal);
    assert.deepEqual(image.dimensions,{width:1200,height:500});
    assert.ok(image.buffer.length>0 && image.preview.startsWith('data:image/png'));
  }
  imports.dialog.showOpenDialog=async()=>({canceled:true});
  assert.equal(await imports.importImage(true,new AbortController().signal),null);
  console.log('IMAGE_IMPORT_SMOKE_OK',JSON.stringify({nativeDecode:true,file:true,clipboardAdapter:true,cancel:true,userClipboardUntouched:true}));
};
