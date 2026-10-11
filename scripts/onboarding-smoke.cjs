const assert = require('node:assert/strict');
module.exports = async ({panel, installer, assets}) => {
  const original = installer.install;
  let installs = 0;
  installer.install = async (kind, progress) => {
    assert.equal(kind,'ocr'); installs++;
    progress({kind,message:'Synthetic verified download',bytes:100});
    await new Promise(resolve=>setTimeout(resolve,150));
    return assets;
  };
  try {
    const result = await panel.webContents.executeJavaScript(`(async()=>{
      document.querySelector('#install-ocr').click();
      const locked=document.querySelector('#install-speech').disabled && document.querySelector('#download-model').disabled;
      for(let i=0;i<100;i++){
        await new Promise(r=>setTimeout(r,50));
        if(!document.querySelector('#install-ocr').disabled) return {locked,message:document.querySelector('#asset-progress').textContent,cancelHidden:document.querySelector('#cancel-assets').hidden};
      }
      throw Error('Optional component UI did not complete');
    })()`);
    assert.equal(installs,1);assert.ok(result.locked);assert.ok(result.cancelHidden);assert.match(result.message,/Installed and verified/);
    const cleared = await panel.webContents.executeJavaScript(`(async()=>{document.querySelector('#clear').click();await new Promise(r=>setTimeout(r,100));return document.querySelector('#web-sources').children.length;})()`);
    assert.equal(cleared,0);
    console.log('ONBOARDING_SMOKE_OK',JSON.stringify({explicitInstall:true,concurrentButtonsLocked:true,progress:true,clearRemovesSources:true,syntheticDownload:true}));
  } finally {installer.install=original;}
};
