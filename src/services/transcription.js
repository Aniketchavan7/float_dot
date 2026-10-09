const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { validateAudio } = require('../shared/validation');
async function findExecutable(directory) {
  try {
    for (const entry of await fs.readdir(directory,{withFileTypes:true})) {
      const target=path.join(directory,entry.name);
      if(entry.isFile() && entry.name==='whisper-cli.exe')return target;
      if(entry.isDirectory()) { const result=await findExecutable(target);if(result)return result; }
    }
  } catch(error) { if(error.code!=='ENOENT')throw error; }
  return null;
}
function hasAudioSignal(wav) {
  let energy=0;const samples=(wav.length-44)/2;
  if(samples<4000)return false;
  for(let i=44;i+1<wav.length;i+=2)energy+=(wav.readInt16LE(i)/32768)**2;
  return Math.sqrt(energy/samples)>=0.0005;
}
function cleanTranscript(output) {
  const value=output.replace(/^\s*\[\d{2}:\d{2}:\d{2}[^\]\r\n]*\]\s*/gm,'').replace(/\[(?:BLANK_AUDIO|SILENCE|MUSIC|NOISE|INAUDIBLE)\]/gi,'').trim();
  return /^(?:thank you|thanks for watching|you)[.!\s]*$/i.test(value) ? '' : value;
}
class TranscriptionService {
  constructor(modelDirectory,tempDirectory,{spawnProcess=spawn,timeoutMs=90000}={}) {
    Object.assign(this,{directory:modelDirectory,temp:tempDirectory,spawnProcess,timeoutMs});
  }
  async ready() { return !!await findExecutable(path.join(this.directory,'whisper')) && !!await fs.stat(path.join(this.directory,'ggml-base.bin')).catch(()=>null); }
  async transcribe(wav,signal) { return this.run(wav,signal,false); }
  async transcribeSegment(wav,signal) { return this.run(wav,signal,true); }
  async run(input,signal,segment) {
    signal.throwIfAborted();
    const wav=validateAudio(input);
    // Energy gate rejects silence; it does not claim to classify speech or accents.
    if(!hasAudioSignal(wav)) {
      if(segment)return '';
      throw new Error('No clear audio detected. Check your microphone and speak again.');
    }
    const executable=await findExecutable(path.join(this.directory,'whisper'));
    const model=path.join(this.directory,'ggml-base.bin');
    if(!executable || !await fs.stat(model).catch(()=>null))throw new Error('Optional local speech files are missing. Open AI Settings for Voice setup.');
    signal.throwIfAborted();
    await fs.mkdir(this.temp,{recursive:true});
    const file=path.join(this.temp,`${randomUUID()}.wav`);
    try {
      await fs.writeFile(file,wav,{mode:0o600});
      signal.throwIfAborted();
      const output=await new Promise((resolve,reject)=>{
        const child=this.spawnProcess(executable,['-m',model,'-f',file,'-l','en','-nt','-np','-t','6'],
          {cwd:path.dirname(executable),windowsHide:true,stdio:['ignore','pipe','pipe']});
        let stdout='',settled=false,pendingError=null;
        const settle=(error,value)=>{
          if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
          error ? reject(error) : resolve(value);
        };
        // Wait for process close before deleting its input file on Windows.
        const stop=error=>{ if(!pendingError)pendingError=error;child.kill(); };
        const abort=()=>stop(new DOMException('Transcription canceled.','AbortError'));
        const timer=setTimeout(()=>stop(new Error('Speech transcription timed out. Try a shorter question.')),segment?Math.min(this.timeoutMs,60000):this.timeoutMs);
        signal.addEventListener('abort',abort,{once:true});
        child.stdout.on('data',data=>{ if(pendingError)return;stdout+=data;if(stdout.length>20000)stop(new Error('Speech output exceeded limit.')); });
        child.stderr.on('data',()=>{});
        child.on('error',()=>settle(pendingError || new Error('Unable to start local speech runtime. Restore the optional speech files.')));
        child.on('close',code=>settle(pendingError || (code===0?null:new Error('Local speech runtime failed. Check model/runtime compatibility.')),stdout));
        if(signal.aborted)abort();
      });
      signal.throwIfAborted();
      const transcript=cleanTranscript(output);
      if(!transcript && !segment)throw new Error('No clear question heard. Please record again.');
      if(transcript.length>2000 && !segment)throw new Error('Question is too long. Please shorten it.');
      return transcript.slice(0,2000);
    } finally { await fs.rm(file,{force:true}); }
  }
}
module.exports={TranscriptionService,findExecutable,hasAudioSignal,cleanTranscript};
