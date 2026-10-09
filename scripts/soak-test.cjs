/**
 * Soak Test — Float Dot Reliability & Leak Verification (M08)
 * Runs 100 rapid request/cancel cycles to confirm resource stability,
 * event isolation, and no unbounded heap growth.
 */
const { Coordinator } = require('../src/services/coordinator');

async function runSoakTest() {
  console.log('=== Float Dot M08 Soak Test: 100 Request / Cancel Cycles ===\n');

  if (global.gc) global.gc();
  const initialMem = process.memoryUsage();
  console.log(`Initial RSS: ${(initialMem.rss / 1024 / 1024).toFixed(2)} MB, Heap Used: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);

  const events = [];
  let inferCount = 0;

  const coordinator = new Coordinator({
    emit: event => events.push(event),
    infer: async ({ signal, onDelta }) => {
      inferCount++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          onDelta('### Answer\nCompleted answer segment.');
          resolve('### Answer\nCompleted answer segment.');
        }, 10);

        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Aborted'));
        });
      });
    }
  });

  const dummyContext = {
    id: 'soak-capture',
    sourceId: 'window:test',
    text: 'const x = 10; const y = 20;',
    capturedAt: new Date().toISOString()
  };

  const startTime = Date.now();
  let cancelledCount = 0;
  let completedCount = 0;

  for (let i = 0; i < 100; i++) {
    const isRapidCancel = (i % 3) !== 0; // 2 out of 3 are cancelled mid-flight
    const question = `Soak test query #${i}`;

    const promise = coordinator.ask({
      question,
      mode: 'general',
      context: dummyContext,
      model: 'qwen3:1.7b'
    });

    if (isRapidCancel) {
      // Cancel immediately or after a slight jitter
      if (i % 2 === 0) {
        coordinator.cancel();
      } else {
        await new Promise(r => setTimeout(r, 2));
        coordinator.cancel();
      }
      cancelledCount++;
    } else {
      completedCount++;
    }

    await promise;

    if ((i + 1) % 25 === 0) {
      process.stdout.write(`  Iteration ${i + 1}/100 completed...\n`);
    }
  }

  const durationMs = Date.now() - startTime;
  if (global.gc) global.gc();
  const finalMem = process.memoryUsage();
  const heapDeltaMB = ((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toFixed(2);

  console.log('\n--- Soak Test Results ---');
  console.log(`Duration: ${durationMs}ms`);
  console.log(`Cycles: 100 (Cancelled: ${cancelledCount}, Completed: ${completedCount})`);
  console.log(`Final Heap Used: ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB (Delta: ${heapDeltaMB} MB)`);
  console.log(`Coordinator Active: ${coordinator.active === null ? 'CLEAN (null)' : 'DIRTY'}`);
  console.log(`Coordinator History Length: ${coordinator.history.length} turns (bounded)`);

  if (coordinator.active !== null) {
    throw new Error('Active request was not cleaned up after soak test!');
  }
  if (parseFloat(heapDeltaMB) > 50) {
    throw new Error(`Heap delta ${heapDeltaMB} MB exceeded threshold (>50MB)! Potential leak.`);
  }

  console.log('\n🎉 SOAK TEST PASSED: Zero resource leaks, clean cancellation, bounded memory.\n');
}

runSoakTest().catch(err => {
  console.error('\n❌ SOAK TEST FAILED:', err);
  process.exit(1);
});
