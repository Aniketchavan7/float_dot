const assert=require('node:assert/strict');
module.exports=async({panel,speech,getReceived})=>{
  const original=speech.transcribe;
  const recognized='Explain nums two with target greater than nine.';
  const corrected='Explain nums[2] with target >= 9. Include a short example.';
  try {
    // Synthetic recognition isolates UI delivery from acoustic accuracy.
    speech.transcribe=async()=>{await new Promise(r=>setTimeout(r,300));return recognized;};
    await panel.webContents.executeJavaScript(`(async()=>{await window.floatDot.settings({mode:'general'});document.querySelector('#refresh-status').click();})()`);
    await new Promise(r=>setTimeout(r,500));
    const result=await panel.webContents.executeJavaScript(`(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      document.querySelector('#setup').hidden=true;
      document.querySelector('#capture').click();
      for(let i=0;i<100 && document.querySelector('#capture-review').hidden;i++)await wait(100);
      if(document.querySelector('#capture-review').hidden)throw Error('Missing initial review');
      document.querySelector('#review-question').value=${JSON.stringify(corrected)};
      const complete=()=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{off();reject(Error('Voice UI answer timed out'));},10000);
        const off=window.floatDot.onAnswer(e=>{if(e.type==='done'||e.type==='error'){clearTimeout(timer);off();e.type==='done'?resolve():reject(Error(e.message));}});
      });
      let done=complete();document.querySelector('#confirm').click();await done;
      document.querySelector('#record').click();
      for(let i=0;i<50 && !document.querySelector('#record').classList.contains('is-recording');i++)await wait(100);
      if(!document.querySelector('#record').classList.contains('is-recording'))throw Error('Microphone did not start');
      await wait(650);document.querySelector('#record').click();
      for(let i=0;i<100 && document.querySelector('#capture-review').hidden;i++)await wait(100);
      if(document.querySelector('#capture-review').hidden)throw Error('Voice follow-up bypassed review');
      if(document.querySelector('#review-question').value!==${JSON.stringify(recognized)})throw Error('Transcript unavailable for correction');
      document.querySelector('#review-question').value=${JSON.stringify(corrected)};
      done=complete();document.querySelector('#confirm').click();await done;
      return {reviewedFollowUp:true,recordingStopped:!document.querySelector('#record').classList.contains('is-recording'),timing:document.querySelector('#voice-timing').textContent};
    })()`);
    const content=getReceived().messages.at(-1).content;
    const finalQuestion=typeof content==='string'?content:content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
    assert.ok(finalQuestion.includes(corrected),'Provider did not receive corrected technical question');
    assert.ok(!finalQuestion.includes(recognized),'Uncorrected recognition leaked into provider question');
    assert.ok(result.recordingStopped);
    console.log('VOICE_REVIEW_SMOKE_OK',JSON.stringify({...result,correctedProviderQuestion:true,recognition:'synthetic adapter',microphone:'Electron fake input'}));
  } finally {speech.transcribe=original;}
};
