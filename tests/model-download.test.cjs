const test = require('node:test');
const assert = require('node:assert/strict');
const {downloadModel} = require('../src/services/model-download');
test('model download handles progress and requires server completion',async()=>{
 const progress=[];const signal=new AbortController().signal;
 await downloadModel('qwen3:1.7b',signal,p=>progress.push(p),async(url,request)=>{
   assert.equal(url,'http://127.0.0.1:11434/api/pull');
   assert.equal(JSON.parse(request.body).model,'qwen3:1.7b');
   return new Response('{"status":"pulling","completed":100}\n{"status":"success"}\n');
 });
 assert.equal(progress[0].bytes,100);
 await assert.rejects(downloadModel('qwen3:1.7b',signal,()=>{},async()=>new Response('{"status":"pulling"}\n')),/before completion/);
 await assert.rejects(downloadModel('qwen3:cloud',signal,()=>{},()=>assert.fail()),/local Ollama/);
});
test('model cancellation reaches HTTP and late success cannot win',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(downloadModel('qwen3:1.7b',controller.signal,()=>{},async(_url,request)=>{
   assert.equal(request.signal.aborted,true);return new Response('{"status":"success"}');
 }),/abort/i);
});
