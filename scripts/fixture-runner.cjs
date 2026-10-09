#!/usr/bin/env node
/**
 * @fileoverview Fixture runner for Float Dot contracts and UI states.
 * Allows executing and verifying all UI fixture states without live Ollama or cloud API credentials.
 * Usage: node scripts/fixture-runner.cjs [--json]
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  validateCaptureContext,
  validateAnswerEvent,
  PROVIDER_CAPABILITIES
} = require('../src/shared/contracts');

const fixturesPath = path.join(__dirname, '../tests/fixtures/contract-fixtures.json');
const rawFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

console.log('=== Float Dot Fixture Runner (M00 Contract Verification) ===\n');

// 1. Verify Idle state fixture
console.log('[1/6] Verifying IDLE fixture...');
if (!rawFixtures.idle || rawFixtures.idle.state !== 'idle') {
  throw new Error('Invalid idle fixture');
}
console.log(`  ✓ State: ${rawFixtures.idle.state}, Model: ${rawFixtures.idle.model}, Source: ${rawFixtures.idle.selectedSource}`);

// 2. Verify Recording state fixture
console.log('\n[2/6] Verifying RECORDING fixture...');
if (!rawFixtures.recording || rawFixtures.recording.state !== 'recording') {
  throw new Error('Invalid recording fixture');
}
console.log(`  ✓ Recording ID: ${rawFixtures.recording.recordingId}, Duration: ${rawFixtures.recording.durationSec}s`);

// 3. Verify Capturing state fixture & CaptureContext
console.log('\n[3/6] Verifying CAPTURING fixture & CaptureContext...');
const captureContext = validateCaptureContext(rawFixtures.capturing.captureContext);
console.log(`  ✓ Capture ID: ${captureContext.id}`);
console.log(`  ✓ Target: ${captureContext.name} (${captureContext.sourceId})`);
console.log(`  ✓ Resolution: ${captureContext.dimensions.width}x${captureContext.dimensions.height}`);
console.log(`  ✓ OCR Confidence: ${captureContext.quality.confidence}%`);

// 4. Verify Answering streaming events
console.log('\n[4/6] Verifying ANSWERING stream fixtures...');
const startedEv = validateAnswerEvent(rawFixtures.answering.startedEvent);
console.log(`  ✓ Started event: requestId=${startedEv.requestId}`);
let accumulatedText = '';
for (const [idx, deltaEv] of rawFixtures.answering.deltaEvents.entries()) {
  const validated = validateAnswerEvent(deltaEv);
  accumulatedText += validated.delta;
  console.log(`  ✓ Delta chunk #${idx + 1} (${validated.delta.length} chars)`);
}

// 5. Verify Completion fixture
console.log('\n[5/6] Verifying COMPLETION fixture...');
const doneEv = validateAnswerEvent(rawFixtures.completion);
console.log(`  ✓ Done event: Turn ${doneEv.turn}, Answer length: ${doneEv.answer.length} chars`);
console.log(`  ✓ Quality warnings: ${doneEv.warnings?.length || 0}`);

// 6. Verify Recoverable Failures fixtures
console.log('\n[6/6] Verifying RECOVERABLE FAILURES fixtures...');
for (const [idx, failure] of rawFixtures.recoverable_failures.entries()) {
  const errEv = validateAnswerEvent(failure);
  console.log(`  ✓ Error #${idx + 1} [${errEv.recoveryAction}]: "${errEv.message}"`);
}

console.log('\n🎉 ALL FIXTURES VALIDATED SUCCESSFULLY AGAINST CONTRACT SCHEMAS.\n');
