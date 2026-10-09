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

export function wantsFreshScreen(question) {
  // Restrict to explicit commands; discussing how to read a screen is a follow-up.
  const command=question.trim().replace(/^(?:please|can you|could you|would you)\s+/i,'');
  if (/\b(?:do not|don't|without|stop)\s+(?:read|capture|recapture|look|tak)/i.test(command)) return false;
  return /^(?:(?:please\s+)?(?:read|capture|recapture|look at)\s+(?:(?:the|my|this|current|new)\s+)*(?:screen|window|display)\b|(?:please\s+)?(?:take|capture)\s+(?:a\s+)?(?:new\s+)?screenshot\b|recapture\b)/i.test(command);
}
