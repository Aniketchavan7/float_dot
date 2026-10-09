const fs=require('node:fs/promises');
const path=require('node:path');
const {TranscriptionService}=require('../src/services/transcription');
async function main() {
  const root=path.resolve(__dirname,'..'),service=new TranscriptionService(path.join(root,'.models'),path.join(root,'.artifacts/voice-temp'));
  const report=[];
  for(const filename of process.argv.slice(2)) {
    // Windows TTS emits an extended fmt chunk. Convert only validated PCM16 mono fixtures.
    const input=await fs.readFile(filename);let format,data;
    for(let offset=12;offset+8<=input.length;) {
      const name=input.toString('ascii',offset,offset+4),size=input.readUInt32LE(offset+4);
      if(offset+8+size>input.length)throw Error('Truncated fixture');
      if(name==='fmt ')format=input.subarray(offset+8,offset+8+size);
      if(name==='data')data=input.subarray(offset+8,offset+8+size);
      offset+=8+size+(size%2);
    }
    if(!format||!data||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==16000||format.readUInt16LE(14)!==16)throw Error('Expected 16 kHz mono PCM16 fixture');
    const wav=Buffer.alloc(44+data.length);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);format.copy(wav,20,0,16);wav.write('data',36);wav.writeUInt32LE(data.length,40);data.copy(wav,44);
    const start=performance.now();const transcript=await service.transcribe(wav,new AbortController().signal);
    report.push({fixture:path.basename(filename),synthetic:true,audioSeconds:data.length/32000,transcriptionMs:Math.round(performance.now()-start),transcript});
  }
  if(!report.length)throw Error('Pass one or more synthetic WAV fixture paths.');
  await fs.writeFile(path.join(root,'.artifacts/voice-fixture-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
