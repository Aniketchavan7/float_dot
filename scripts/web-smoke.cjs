const assert = require('node:assert/strict');
const http = require('node:http');
module.exports = async ({panel, captureService, getReceived}) => {
  let searches = 0;
  const server = http.createServer((req, res) => {
    searches++;
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.pathname, '/search');
    assert.ok(['two sum', 'JavaScript Map documentation'].includes(url.searchParams.get('q')));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({results:[{url:'https://example.com/reference',title:'Synthetic coding reference',content:'Use a hash map.'}]}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const original = captureService.capture;
  captureService.capture = () => { throw new Error('Web search must not capture'); };
  try {
    const result = await panel.webContents.executeJavaScript(`(async () => {
      await window.floatDot.settings({webEnabled:true,searxURL:'http://127.0.0.1:${server.address().port}'});
      document.querySelector('#reuse-capture').checked=false;
      document.querySelector('#question').value='two sum';
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{off();reject(Error('Web answer timed out'));},10000);
        const off=window.floatDot.onAnswer(event=>{
          if(event.type==='error'){clearTimeout(timer);off();reject(Error(event.message));}
          if(event.type==='done'){clearTimeout(timer);off();setTimeout(()=>resolve({sources:event.sources,buttons:document.querySelector('#web-sources').textContent}),100);}
        });
        document.querySelector('#send').click();
      });
    })()`);
    assert.equal(searches, 1);
    const health = await panel.webContents.executeJavaScript(`(async()=>{document.querySelector('#searx-url').value='http://127.0.0.1:${server.address().port}';document.querySelector('#test-web').click();for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,50));if(!document.querySelector('#test-web').disabled)return document.querySelector('#web-connection-status').textContent;}throw Error('Connection test timed out');})()`);
    assert.match(health, /Search connected/);
    assert.equal(searches, 2);
    assert.equal(result.sources.length, 1);
    assert.match(result.buttons, /Synthetic coding reference/);
    assert.match(JSON.stringify(getReceived()), /Use a hash map/);
    const denied = await panel.webContents.executeJavaScript(`window.floatDot.openSource({requestId:'invalid',id:1})`);
    assert.equal(denied.ok, false);
    console.log('WEB_SEARCH_SMOKE_OK', JSON.stringify({searches,sourceButtons:1,connectionTest:true,captureCalls:0,forgedSourceRejected:true,syntheticOnly:true}));
  } finally {
    captureService.capture = original;
    await panel.webContents.executeJavaScript(`window.floatDot.settings({webEnabled:false})`);
    await new Promise(resolve => server.close(resolve));
  }
};
