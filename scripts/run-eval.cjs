// Runs evaluation cases against the local Ollama instance (configurable model)
const fs = require('node:fs/promises');
const path = require('node:path');
const { streamAnswer, listModels } = require('../src/services/model');
const { buildMessages } = require('../src/services/prompts');
const { normalizeAnswer, assessAnswer } = require('../src/services/answer-quality');

function median(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    model: null,
    sample: false,
    reasoning: false,
    limit: null,
    timeoutMs: 60000
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      options.model = args[i + 1];
      i++;
    } else if (args[i] === '--sample') {
      options.sample = true;
    } else if (args[i] === '--reasoning') {
      options.reasoning = true;
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      options.timeoutMs = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return options;
}

async function run() {
  const options = parseArgs();
  const corpusPath = path.join(__dirname, '../tests/fixtures/eval-corpus.json');
  const corpus = JSON.parse(await fs.readFile(corpusPath, 'utf8'));

  let models = [];
  try {
    models = await listModels();
  } catch (err) {
    console.error('Local Ollama is not running at 127.0.0.1:11434. Start Ollama to run live inference evaluation.');
    process.exit(1);
  }

  // Choose requested model or select preferred available model in speed order
  let model = options.model;
  if (!model) {
    const preferences = ['qwen3:1.7b', 'llama3.2:3b', 'phi3:3.8b', 'qwen3:4b'];
    for (const pref of preferences) {
      if (models.some(m => m.name === pref)) {
        model = pref;
        break;
      }
    }
    if (!model && models.length > 0) {
      model = models[0].name;
    }
  }

  if (!model || !models.some(m => m.name === model)) {
    console.error(`Model "${model || 'unknown'}" is not downloaded in Ollama.`);
    console.error(`Available models: ${models.map(m => m.name).join(', ') || 'none'}`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`Float Dot AI Verification: ${model}`);
  console.log(`Reasoning: ${options.reasoning ? 'ENABLED (/think)' : 'DISABLED (concise non-thinking)'}`);
  console.log(`Timeout per case: ${options.timeoutMs}ms`);
  console.log(`======================================================\n`);

  let sampleIndices = corpus.map((_, index) => index);
  if (options.sample) {
    sampleIndices = [0, 10, 20]; // 1 dsa, 1 debug, 1 explain
  } else if (options.limit && options.limit > 0) {
    sampleIndices = sampleIndices.slice(0, options.limit);
  }

  const results = [];
  const ttfbList = [];
  const durationList = [];

  for (const idx of sampleIndices) {
    const testCase = corpus[idx];
    process.stdout.write(`[${testCase.id}] ${testCase.mode.toUpperCase()}: ${testCase.name} ... `);

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
        reasoning: options.reasoning,
        messages,
        signal: AbortSignal.timeout(options.timeoutMs),
        onDelta: (delta) => {
          if (!firstTokenTime) firstTokenTime = Date.now();
          fullResponse += delta;
        }
      });

      const totalDuration = Date.now() - startTime;
      const ttfb = firstTokenTime ? firstTokenTime - startTime : totalDuration;
      ttfbList.push(ttfb);
      durationList.push(totalDuration);

      fullResponse = normalizeAnswer(fullResponse);
      const quality = assessAnswer({ answer: fullResponse, mode: testCase.mode, question: testCase.spokenQuestion });
      // Keywords and formatting are screening checks, not proof of correctness.
      let forbiddenViolations = [];
      if (testCase.forbiddenInHint1) {
        forbiddenViolations = testCase.forbiddenInHint1.filter(kw => fullResponse.toLowerCase().includes(kw.toLowerCase()));
      }

      // Check required concepts
      const matchedKeywords = (testCase.requiredKeywords || []).filter(kw => fullResponse.toLowerCase().includes(kw.toLowerCase()));
      const passed = forbiddenViolations.length === 0 && matchedKeywords.length > 0 && quality.structured;

      results.push({
        id: testCase.id,
        name: testCase.name,
        mode: testCase.mode,
        passed,
        ttfbMs: ttfb,
        totalDurationMs: totalDuration,
        matchedKeywords,
        forbiddenViolations,
        formatIssues: quality.issues,
        humanReviewRequired: true,
        response: fullResponse,
        reviewStatus: passed ? 'heuristic-pass' : 'heuristic-fail',
        responseExcerpt: fullResponse.slice(0, 120).replace(/\n/g, ' ') + '...'
      });

      console.log(`${passed ? 'PASS' : 'FAIL'} | TTFB: ${ttfb}ms | Total: ${totalDuration}ms`);
      if (!passed) {
        for (const issue of quality.issues) console.log(`  -> ${issue}`);
        if (forbiddenViolations.length > 0) {
          console.log(`  -> Forbidden keyword violation: ${forbiddenViolations.join(', ')}`);
        }
        if (matchedKeywords.length === 0) {
          console.log(`  -> Missing required keywords: ${(testCase.requiredKeywords || []).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
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

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const passRate = Math.round((passedCount / totalCount) * 100);
  const medianTTFB = median(ttfbList);
  const medianDuration = median(durationList);
  const avgTTFB = ttfbList.length ? Math.round(ttfbList.reduce((a, b) => a + b, 0) / ttfbList.length) : 0;

  console.log(`\n======================================================`);
  console.log(`EVALUATION SUMMARY: ${model}`);
  console.log(`======================================================`);
  console.log(`Cases Evaluated: ${totalCount}`);
  console.log(`Passed (Heuristic): ${passedCount}/${totalCount} (${passRate}%)`);
  console.log(`Median TTFB: ${medianTTFB}ms (${(medianTTFB / 1000).toFixed(2)}s)`);
  console.log(`Average TTFB: ${avgTTFB}ms (${(avgTTFB / 1000).toFixed(2)}s)`);
  console.log(`Median Total Duration: ${medianDuration}ms (${(medianDuration / 1000).toFixed(2)}s)`);

  const heuristicTargetMet = totalCount > 0 && passedCount >= Math.ceil(totalCount * 0.8);
  const latencyGateMet = ttfbList.length === totalCount && totalCount > 0 && medianTTFB <= 15000;
  console.log(`Heuristic screening (>= 80%): ${heuristicTargetMet ? 'MET' : 'NOT MET'}`);
  console.log(`Latency Target (Median TTFB <= 15s): ${latencyGateMet ? 'MET' : 'NOT MET'}`);
  console.log('Release quality: NOT CERTIFIED. Review correctness, grounding, hint leakage, and actual screenshot/audio flows.');

  const reportDir = path.join(__dirname, '../.artifacts');
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, 'evaluation-report.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    model: models.find(m => m.name === model) || { name: model },
    reasoning: options.reasoning,
    scope: 'Supplied text fixtures only; excludes capture, OCR, microphone, and speech transcription.',
    humanReviewRequired: true,
    summary: {
      casesRun: totalCount,
      passedCount,
      passRate,
      medianTTFBMs: medianTTFB,
      avgTTFBMs: avgTTFB,
      medianDurationMs: medianDuration,
      heuristicTargetMet,
      qualityGateMet: false,
      latencyGateMet,
      overallGatePassed: false
    },
    results
  }, null, 2));

  console.log(`\nFull report saved to: ${path.join(reportDir, 'evaluation-report.json')}`);

  if (!heuristicTargetMet || !latencyGateMet) {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
