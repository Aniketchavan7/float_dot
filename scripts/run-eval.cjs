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

  // Full coverage by default. Sampling is explicitly opt-in, never a release gate.
  const sampleIndices = process.argv.includes('--sample') ? [0, 10, 20] : corpus.map((_, index) => index);
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
        reasoning: process.argv.includes('--reasoning'),
        messages,
        signal: AbortSignal.timeout(120000),
        onDelta: (delta) => {
          if (!firstTokenTime) firstTokenTime = Date.now();
          fullResponse += delta;
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
        response: fullResponse,
        reviewStatus: 'pending-human-review',
        responseExcerpt: fullResponse.slice(0, 150).replace(/\n/g, ' ') + '...'
      });

      console.log(`Heuristic: ${passed ? 'MATCH' : 'FAIL'} (human review required) | TTFB: ${ttfb}ms | Total: ${totalDuration}ms`);
      console.log(`Answer excerpt: "${results.at(-1).responseExcerpt}"\n`);
    } catch (err) {
      console.error(`FAILED: ${err.message}\n`);
      results.push({
        id: testCase.id,
        name: testCase.name,
        mode: testCase.mode,
        passed: false,
        response: fullResponse,
        reviewStatus: 'failed-inference',
        error: err.message
      });
    }
  }

  const allPassed = results.every(r => r.passed);
  const reportDir = path.join(__dirname, '../.artifacts');
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, 'evaluation-report.json'), JSON.stringify({
    createdAt: new Date().toISOString(), model: models.find(m => m.name === model),
    reasoning: process.argv.includes('--reasoning'),
    scope: 'Corrected text only; does not evaluate microphone or OCR',
    releaseGatePassed: false, humanReviewRequired: true, casesRun: results.length, results
  }, null, 2));
  console.log(`\nHeuristic matches: ${results.filter(r => r.passed).length}/${results.length}. Full answers saved for human review; this is not a release-gate pass.`);
  if (!allPassed) {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
