const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { searchWeb, withWeb, boundedJSON } = require('../src/services/web-tools');
const { validateSettings } = require('../src/shared/validation');
const input = () => ({ question: 'JavaScript Map lookup', model: 'qwen3:1.7b', signal: new AbortController().signal, messages: [{role:'system',content:'Coding assistant'}, {role:'user',content:'Private screen context'}, {role:'user',content:'question and format'}] });
test('disabled web performs no planning or search', async () => {
 const i=input(); assert.equal(await withWeb(i, {webEnabled:false}, async passed => {assert.equal(passed,i);return 'answer';}, {fetcher:()=>assert.fail(),search:()=>assert.fail()}), 'answer');
});
test('Ollama tool only receives question and performs one search', async () => {
 const i=input(); let calls=0; let sources; i.onSources=v=>sources=v;
 const result=await withWeb(i,{webEnabled:true,provider:'ollama',searxURL:'http://localhost:8888'},async passed=>{assert.equal(passed.messages.at(-1),i.messages.at(-1));assert.match(passed.messages.at(-2).content,/untrusted/);return 'code';},{fetcher:async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.tools.length,1);assert.ok(!JSON.stringify(body).includes('Private screen'));return Response.json({message:{tool_calls:[{function:{name:'search_web',arguments:{query:'MDN Map'}}},{function:{name:'capture_screen'}}]}});},search:async args=>{calls++;assert.equal(args.query,'MDN Map');return [{id:1,title:'Map',url:'https://developer.mozilla.org/',excerpt:'reference'}];}});
 assert.equal(result,'code');assert.equal(calls,1);assert.equal(sources.length,1);
});
test('unsupported models and unknown tools fall back to question search', async () => {
 for(const response of [()=>Response.json({}, {status:400}),()=>Response.json({message:{tool_calls:[{function:{name:'unknown_tool'}}]}})]) {
 await withWeb(input(),{webEnabled:true,provider:'ollama'},async()=>'',{fetcher:async()=>response(),search:async args=>{assert.equal(args.query,'JavaScript Map lookup');return [];}});
 }
});
test('cloud providers search without Ollama planning', async()=>{
 await withWeb(input(),{webEnabled:true,provider:'anthropic'},async()=>'',{fetcher:()=>assert.fail(),search:async()=>[]});
});
test('SearXNG HTTP adapter encodes query, filters URLs and limits references', async t=>{
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');assert.equal(u.searchParams.get('q'),'C++ & map');assert.equal(u.searchParams.get('format'),'json');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results:[{url:'file:///example'},...Array.from({length:8},()=>({url:'https://example.com',title:'A',content:'x'.repeat(3000)}))]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const results=await searchWeb({endpoint:`http://127.0.0.1:${server.address().port}`,query:'C++ & map'});assert.equal(results.length,5);assert.equal(results[0].excerpt.length,1400);
});
test('failed, oversized and canceled searches do not silently generate',async()=>{
 await assert.rejects(searchWeb({endpoint:'http://localhost:8888',query:'test',fetcher:async()=>Response.json({}, {status:403})}),/enable JSON/);
 await assert.rejects(boundedJSON(new Response('x'.repeat(100)),20),/too large/);
 const i=input();const c=new AbortController();c.abort();i.signal=c.signal;
 await assert.rejects(withWeb(i,{webEnabled:true,provider:'ollama'},()=>assert.fail(),{fetcher:async()=>{throw new Error('aborted');},search:()=>assert.fail()}),/aborted/);
 assert.throws(()=>validateSettings({searxURL:'http://example.com'}));
 assert.deepEqual(validateSettings({webEnabled:true,searxURL:'http://localhost:8888'}),{webEnabled:true,searxURL:'http://localhost:8888'});
});
