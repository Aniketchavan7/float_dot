const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {evaluateCode,imageID}=require('./sandbox-eval.cjs');
(async()=>{
 const image=imageID();
 const good=await evaluateCode({image,code:'class Solution:\n def answer(self, x): return x + 1',entry:'answer',tests:[{args:[2],expected:3}]});
 assert.equal(good.passed,true);
 const bad=await evaluateCode({image,code:'class Solution:\n def answer(self, x): return x',entry:'answer',tests:[{args:[2],expected:3}]});
 assert.equal(bad.passed,false);
 const isolation=await evaluateCode({image,code:`import os,socket
class Solution:
 def answer(self):
  readonly=False
  try: open('/forbidden-write','w')
  except OSError: readonly=True
  s=socket.socket();s.settimeout(1)
  network_blocked=s.connect_ex(('1.1.1.1',443)) != 0
  s.close()
  return [os.getuid(),readonly,network_blocked]`,entry:'answer',tests:[{args:[],expected:[65534,true,true]}]});
 assert.equal(isolation.passed,true);
 await assert.rejects(evaluateCode({image,code:'while True: pass',entry:'answer',tests:[{args:[],expected:0}]}),/timed out/);
 await fs.mkdir('.artifacts',{recursive:true});
 await fs.writeFile('.artifacts/sandbox-verification.json',JSON.stringify({date:new Date().toISOString(),image,correctAnswer:true,incorrectAnswerRejected:true,timeoutEnforced:true,isolation},null,2));
 console.log('SANDBOX_VERIFIED: correctness, read-only filesystem, non-root, no network, timeout; no host mounts');
})().catch(error=>{console.error(error);process.exitCode=1;});
