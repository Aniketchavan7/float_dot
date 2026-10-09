const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {TranscriptionService,cleanTranscript}=require('../src/services/transcription');
const load=async name=>import(`data:text/javascript;base64,${Buffer.from(await fs.readFile(path.join(__dirname,'../src/renderer',name),'utf8')).toString('base64')}`);
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function microphone({permission,worklet}={}) {
  const tracks=[],contexts=[],nodes=[];
  const env={navigator:{mediaDevices:{getUserMedia:async()=>{
    if(permission)await permission;
    const track=new EventTarget();track.stopped=false;track.stop=()=>{track.stopped=true;};tracks.push(track);
    return{getTracks:()=>[track]};
  }}},AudioContext:class{
    constructor(){this.sampleRate=16000;this.closed=false;this.audioWorklet={addModule:()=>worklet||Promise.resolve()};contexts.push(this);}
    createMediaStreamSource(){return{connect(){},disconnect(){}};}
    createGain(){return{gain:{},connect(){},disconnect(){}};}
    async resume(){}async close(){this.closed=true;}
  },AudioWorkletNode:class{constructor(){this.port={};nodes.push(this);}connect(){}disconnect(){}}};
  return{env,tracks,contexts,nodes};
}
test('cancel while permission is pending stops late tracks without activating microphone',async()=>{
  const {Recorder}=await load('audio.js'),gate=deferred(),mic=microphone({permission:gate.promise});
  const recorder=new Recorder(()=>{},()=>{},mic.env);const start=recorder.start();recorder.cancel();gate.resolve();
  assert.equal(await start,false);assert.ok(mic.tracks.every(t=>t.stopped));assert.equal(recorder.active,false);
});
test('old worklet completion cannot cancel a newer recording',async()=>{
  const {Recorder}=await load('audio.js'),gate=deferred(),old=microphone({worklet:gate.promise}),fresh=microphone();
  const recorder=new Recorder(()=>{},()=>{},old.env);const start=recorder.start();await tick();
  recorder.cancel();recorder.environment=fresh.env;await recorder.start();gate.resolve();await start;
  assert.equal(recorder.active,true);assert.equal(fresh.tracks[0].stopped,false);assert.equal(old.tracks[0].stopped,true);
  recorder.cancel();assert.ok(fresh.contexts[0].closed);
});
test('20 recording cycles stop/cancel without leaving tracks or contexts active',async()=>{
  const {Recorder}=await load('audio.js'),mic=microphone();const recorder=new Recorder(()=>{},()=>{},mic.env);
  for(let i=0;i<20;i++){await recorder.start();mic.nodes.at(-1).port.onmessage({data:new Float32Array(5000).fill(0.1)});if(i%2)await recorder.stop();else recorder.cancel();assert.equal(recorder.active,false);}
  assert.ok(mic.tracks.every(t=>t.stopped));assert.ok(mic.contexts.every(c=>c.closed));
});
test('disconnected device releases resources and gives a recovery message',async()=>{
  const {Recorder}=await load('audio.js'),mic=microphone();let message;
  const recorder=new Recorder(()=>{},e=>{message=e.message;},mic.env);await recorder.start();mic.tracks[0].dispatchEvent(new Event('ended'));
  assert.equal(recorder.active,false);assert.ok(mic.contexts[0].closed);assert.match(message,/disconnected/);
});
test('30-second limit fires once and canceled recordings cannot trigger a late limit',async t=>{
  const {Recorder}=await load('audio.js'),mic=microphone();let limits=0;
  t.mock.timers.enable({apis:['setTimeout']});
  const recorder=new Recorder(()=>{limits++;recorder.cancel();},()=>{},mic.env);
  await recorder.start();t.mock.timers.tick(30000);assert.equal(limits,1);assert.ok(mic.tracks[0].stopped);
  await recorder.start();recorder.cancel();t.mock.timers.tick(30000);assert.equal(limits,1);
});
test('permission denial and missing selected device produce specific recovery errors',async()=>{
  const {Recorder}=await load('audio.js');
  for(const [name,match] of [['NotAllowedError',/Windows Settings/],['OverconstrainedError',/System default/]]) {
    const mic=microphone();mic.env.navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(Error('raw'),{name});};
    const recorder=new Recorder(()=>{},()=>{},mic.env);await assert.rejects(recorder.start(),match);assert.equal(recorder.active,false);
  }
});
test('silence is rejected after releasing the device; quiet audible signal is preserved',async()=>{
  const {Recorder}=await load('audio.js'),mic=microphone(),recorder=new Recorder(()=>{},()=>{},mic.env);
  await recorder.start();mic.nodes.at(-1).port.onmessage({data:new Float32Array(5000)});await assert.rejects(recorder.stop(),/No clear audio/);assert.ok(mic.tracks[0].stopped);
  await recorder.start();mic.nodes.at(-1).port.onmessage({data:new Float32Array(5000).fill(0.002)});assert.ok((await recorder.stop()).length>44);
});
test('canceled transcription never overwrites a newer result and stage timings exclude review delay',async()=>{
  const {VoiceController}=await load('voice-controller.js'),gate=deferred();let time=0;
  const voice=new VoiceController({transcribe:()=>gate.promise,now:()=>time});const first=voice.recognize([]);voice.cancel();gate.resolve('old');assert.equal(await first,null);
  voice.transcribe=async()=>{time+=400;return 'new';};assert.equal(await voice.recognize([]),'new');time+=10000;voice.submitted();time+=250;
  assert.equal(voice.firstAnswer().transcriptionMs,400);assert.equal(voice.firstAnswer().firstAnswerMs,250);assert.equal(voice.firstAnswer().endOfSpeechToAnswerMs,10650);
});
test('only explicit screen commands request recapture, not explanatory or negated follow-ups',async()=>{
  const {wantsFreshScreen}=await load('voice-controller.js');
  for(const q of ['Read the screen','Could you capture my window?','Take a new screenshot','Please recapture the display'])assert.equal(wantsFreshScreen(q),true,q);
  for(const q of ['Explain how to read the screen','Do not capture the screen','Why does this function read the window?','Explain line 12'])assert.equal(wantsFreshScreen(q),false,q);
});
test('main-process silence gate bypasses Whisper and rejects forged WAV',async()=>{
  const {encodeWav}=await load('audio.js');const service=new TranscriptionService('missing','unused',{spawnProcess:()=>{throw Error('Must not spawn');}});
  const silence=encodeWav([new Float32Array(16000)],16000),signal=new AbortController().signal;
  assert.equal(await service.transcribeSegment(silence,signal),'');await assert.rejects(service.transcribe(silence,signal),/No clear audio/);await assert.rejects(service.transcribe(Buffer.alloc(100),signal),/Recording/);
  assert.equal(cleanTranscript('[BLANK_AUDIO] [MUSIC]'),'');assert.equal(cleanTranscript('Use nums[2] and n >= 10.'),'Use nums[2] and n >= 10.');
  assert.equal(cleanTranscript('[00:00:01.000 --> 00:00:02.000] Use nums[2].'),'Use nums[2].');
});
test('Whisper abort waits for child close and removes temporary audio',async()=>{
  const parent=path.resolve(__dirname,'../.artifacts');await fs.mkdir(parent,{recursive:true});const directory=await fs.mkdtemp(path.join(parent,'voice-runtime-'));
  try {
    await fs.mkdir(path.join(directory,'whisper'));await fs.writeFile(path.join(directory,'whisper/whisper-cli.exe'),'fixture');await fs.writeFile(path.join(directory,'ggml-base.bin'),'fixture');
    const {encodeWav}=await load('audio.js'),spawned=deferred(),child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();let killed=false;
    child.kill=()=>{killed=true;setImmediate(()=>child.emit('close',1));};
    const service=new TranscriptionService(directory,path.join(directory,'temp'),{spawnProcess:()=>{spawned.resolve();return child;}});
    const controller=new AbortController(),job=service.transcribe(encodeWav([new Float32Array(5000).fill(0.1)],16000),controller.signal);
    await spawned.promise;controller.abort();await assert.rejects(job,{name:'AbortError'});assert.ok(killed);assert.deepEqual(await fs.readdir(service.temp),[]);
  } finally { assert.equal(path.dirname(directory),parent);await fs.rm(directory,{recursive:true,force:true}); }
});
