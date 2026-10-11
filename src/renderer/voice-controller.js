// Owns transcription cancellation and stage timings; never stores audio or transcript logs.
export class VoiceController {
  constructor({transcribe,now=()=>performance.now()}) { this.transcribe=transcribe;this.now=now;this.generation=0;this.timings=null; }
  cancel() { this.generation++;this.timings=null; }
  async recognize(wav) {
    const generation=++this.generation,start=this.now();
    this.timings={endOfSpeech:start};
    try {
      const transcript=await this.transcribe(wav);
      if(generation!==this.generation)return null;
      this.timings.transcriptionMs=this.now()-start;
      return transcript;
    } catch(error) { if(generation!==this.generation)return null;throw error; }
  }
  submitted() { if(this.timings)this.timings.submitted=this.now(); }
  firstAnswer() {
    if(this.timings && this.timings.firstAnswerMs===undefined && this.timings.submitted!==undefined) {
      this.timings.firstAnswerMs=this.now()-this.timings.submitted;
      this.timings.endOfSpeechToAnswerMs=this.now()-this.timings.endOfSpeech;
    }
    return this.timings;
  }
}
