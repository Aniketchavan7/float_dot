// Runs evaluation cases against the local Ollama instance (qwen3:4b)
const fs = require('node:fs/promises');
const path = require('node:path');
const { streamAnswer, listModels } = require('../src/services/model');
const { buildMessages } = require('../src/services/prompts');

async function run() {
  const corpusPath = path.join(__dirname, '../tests/fixtures/eval-corpus.json');
  const corpus = JSON.parse(await fs.readFile(corpusPath, 'utf8'));

  let models = [];
  try {
    models = await listModels();
  } catch (err) {
    console.error('Local Ollama is not running at 127.0.0.1:11434. Start Ollama to run live inference evaluation.');
    process.exit(1);
  }

  const model = models.find(m => m.name === 'qwen3:4b')?.name || models[0]?.name;
  if (!model) {
    console.error('No downloaded Qwen3 model found. Run: ollama pull qwen3:4b');
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`Float Dot AI Verification: ${model}`);
  console.log(`Running evaluation cases from corpus...`);
  console.log(`========================================\n`);

  // Run 3 representative benchmark cases (one from each mode) for fast verification
  const sampleIndices = [0, 10, 20]; // Two Sum (DSA), Undefined map (Debug), useEffect (General)
  const results = [];

  for (const idx of sampleIndices) {
    const testCase = corpus[idx];
    console.log(`[${testCase.id}] ${testCase.mode.toUpperCase()}: ${testCase.name}`);
    console.log(`Question: "${testCase.spokenQuestion}"`);

    const messages = buildMessages({
      mode: testCase.mode,
      question: testCase.spokenQuestion,
      context: { id: testCase.id, text: testCase.screenText, capturedAt: new Date().toISOString() },
      hintLevel: 0
    });

    const startTime = Date.now();
    let firstTokenTime = null;
    let fullResponse = '';

    try {
      fullResponse = await streamAnswer({
        model,
        messages,
        signal: AbortSignal.timeout(60000),
        onDelta: (delta) => {
          if (!firstTokenTime) firstTokenTime = Date.now();
        }
      });

      const totalDuration = Date.now() - startTime;
      const ttfb = firstTokenTime ? firstTokenTime - startTime : totalDuration;

      // Check forbidden keywords
      let forbiddenViolations = [];
      if (testCase.forbiddenInHint1) {
        forbiddenViolations = testCase.forbiddenInHint1.filter(kw => fullResponse.toLowerCase().includes(kw.toLowerCase()));
      }

      // Check required concepts
      const matchedKeywords = (testCase.requiredKeywords || []).filter(kw => fullResponse.toLowerCase().includes(kw.toLowerCase()));

      const passed = forbiddenViolations.length === 0 && matchedKeywords.length > 0;

      results.push({
        id: testCase.id,
        name: testCase.name,
        mode: testCase.mode,
        passed,
        ttfbMs: ttfb,
        totalDurationMs: totalDuration,
        matchedKeywords,
        forbiddenViolations,
        responseExcerpt: fullResponse.slice(0, 150).replace(/\n/g, ' ') + '...'
      });

      console.log(`Status: ${passed ? 'PASS' : 'WARN'} | TTFB: ${ttfb}ms | Total: ${totalDuration}ms`);
      console.log(`Answer excerpt: "${results.at(-1).responseExcerpt}"\n`);
    } catch (err) {
      console.error(`FAILED: ${err.message}\n`);
      results.push({
        id: testCase.id,
        name: testCase.name,
        mode: testCase.mode,
        passed: false,
        error: err.message
      });
    }
  }

  const allPassed = results.every(r => r.passed);
  console.log(`\nEvaluation Summary: ${results.filter(r => r.passed).length}/${results.length} passed.`);
  if (!allPassed) {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
