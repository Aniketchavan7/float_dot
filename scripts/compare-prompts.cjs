// Controlled local prompt comparison; never calls a paid/cloud provider.
const fs = require('node:fs/promises');
const path = require('node:path');
const { normalizeAnswer, assessAnswer } = require('../src/services/answer-quality');
const corpus = require('../tests/fixtures/eval-corpus.json');
async function run() {
  const baselinePath = path.resolve(process.argv[2] || '.artifacts/prompts-before-enhancement.cjs');
  const candidatePath = path.resolve(process.argv[3] || 'src/services/prompts.js');
  const outputPath = path.resolve(process.argv[4] || '.artifacts/prompt-comparison.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const variants = { baseline: require(baselinePath), candidate: require(candidatePath) };
  const selected = ['dsa-01','dsa-05','debug-12','debug-15','general-26','general-28'];
  const cases = corpus.filter(c => selected.includes(c.id)).map(c => ({ ...c }));
  // Remove a runtime ambiguity in the original corpus. Same input for both variants.
  cases.find(c => c.id === 'general-28').screenText = "Node.js CommonJS (.cjs), at top level:\nsetTimeout(() => console.log('timeout'), 0);\nPromise.resolve().then(() => console.log('promise'));\nprocess.nextTick(() => console.log('nextTick'));";
  cases.push({ id:'missing-evidence', mode:'debug', screenText:'The application crashed. Error text is cropped out.', spokenQuestion:'What exact line of my code is wrong?', expectedBehavior:'State that the line/cause is unknown; request the actual error/stack trace. Do not invent a diagnosis.' });
  cases.push({ id:'heldout-scope', mode:'general', screenText:'const count = 1;\nif (true) { const count = 2; }\nconsole.log(count);', spokenQuestion:'What gets printed, and why?', expectedBehavior:'Prints 1. Inner block binding shadows without modifying outer binding; the log is outside the block. A correct numeral with an incorrect explanation fails.' });
  const model = 'qwen3:1.7b';
  const metadata = await (await fetch('http://127.0.0.1:11434/api/tags')).json();
  if (!metadata.models?.some(m => m.name === model && !m.remote_host && !m.remote_model)) throw new Error('Local qwen3:1.7b must be installed.');
  const results = [];
  const settings = { num_ctx:8192, num_predict:1024, temperature:0.3 };
  for (const seed of [17,42]) for (const c of cases) {
    // Reverse run order on second seed to reduce warm-up/order bias.
    for (const name of seed === 17 ? ['baseline','candidate'] : ['candidate','baseline']) {
      const messages = variants[name].buildMessages({ mode:c.mode, question:c.spokenQuestion, context:{ id:c.id,text:c.screenText,capturedAt:'2026-10-09T00:00:00Z' }, hintLevel:0 });
      messages.at(-1).content += '\n/no_think';
      const start = Date.now();
      const response = await fetch('http://127.0.0.1:11434/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(30000), body:JSON.stringify({ model,messages,think:false,stream:false,keep_alive:'5m',options:{...settings,seed} }) });
      if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
      const raw = await response.json();
      const answer = normalizeAnswer(raw.message?.content || '');
      const quality = assessAnswer({ answer,mode:c.mode,question:c.spokenQuestion });
      const result = { id:c.id,variant:name,seed,question:c.spokenQuestion,screenText:c.screenText,reviewRubric:c.expectedBehavior,messages,answer,quality,doneReason:raw.done_reason,totalMs:Date.now()-start,promptTokens:raw.prompt_eval_count,outputTokens:raw.eval_count,manualReviewRequired:true };
      results.push(result);
      console.log(`${c.id} ${name} seed=${seed} ${result.totalMs}ms format=${quality.structured}`);
      await fs.writeFile(outputPath,JSON.stringify({createdAt:new Date().toISOString(),model:metadata.models.find(m=>m.name===model),settings,scope:'Same local model, evidence, question, seed and decoding; no correctness score inferred from formatting. Seeds reduce variation but do not guarantee deterministic output.',results},null,2));
    }
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
