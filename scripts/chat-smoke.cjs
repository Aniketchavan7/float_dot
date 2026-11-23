const assert=require('node:assert/strict');
module.exports=async({panel,captureService,getReceived})=>{
  const original=captureService.capture;let captureCalls=0,allowCapture=false;
  captureService.capture=async(...args)=>{captureCalls++;if(allowCapture)return original.apply(captureService,args);throw Error('Chat must not capture the screen');};
  try {
    for (const [question,attach] of [['give code',true],['two sum',false],['Read the screen',false],['Take a new screenshot',false]]) {
    const result=await panel.webContents.executeJavaScript(`(async()=>{
      document.querySelector('#reuse-capture').checked=${attach};
      document.querySelector('#question').value=${JSON.stringify(question)};
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{off();reject(Error('Chat produced no visible answer'));},10000);
        const off=window.floatDot.onAnswer(e=>{
          if(e.type==='error'){clearTimeout(timer);off();reject(Error(e.message));}
          if(e.type==='done'){clearTimeout(timer);off();setTimeout(()=>resolve({text:document.querySelector('#answer').textContent,visible:!document.querySelector('#answer-section').hidden,evidenceHidden:document.querySelector('#evidence-details').hidden,reviewHidden:document.querySelector('#capture-review').hidden}),100);}
        });
        document.querySelector('#send').click();
      });
    })()`);
    assert.equal(captureCalls,0);assert.ok(result.visible && result.text.includes('Two Sum'));assert.equal(result.evidenceHidden,!attach);assert.ok(result.reviewHidden);
    const request=getReceived();assert.equal(JSON.stringify(request.messages).includes('image_url'),attach);
    assert.equal(JSON.stringify(request.messages).includes('<screen_excerpt>'),attach);
    console.log('CHAT_ROUTING_SMOKE_OK',JSON.stringify({question,captureCalls,visibleAnswer:result.visible,screenEvidenceSent:attach,imageSent:attach}));
    }
    allowCapture=true;
    panel.webContents.send('fd:hotkey');
    const reviewed=await panel.webContents.executeJavaScript(`(async()=>{for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));if(!document.querySelector('#capture-review').hidden)return true;}return false;})()`);
    assert.ok(reviewed,'Capture shortcut did not open preview');assert.equal(captureCalls,1);
    console.log('EXPLICIT_CAPTURE_SHORTCUT_SMOKE_OK',JSON.stringify({captureCalls,reviewed}));
  } finally {captureService.capture=original;}
};
