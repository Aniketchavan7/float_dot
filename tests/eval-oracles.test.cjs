const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

// Fixed, reviewed snippets only. Never execute model output or captured screen code.
test('CommonJS event-loop reference answer is verified by the runtime', () => {
  const output = execFileSync(process.execPath, ['--input-type=commonjs', '-e', "setTimeout(() => console.log('timeout'), 0); Promise.resolve().then(() => console.log('promise')); process.nextTick(() => console.log('nextTick'));"], { encoding:'utf8', timeout:5000 });
  assert.deepEqual(output.trim().split(/\r?\n/), ['nextTick','promise','timeout']);
});

test('block-scope reference answer is verified independently of the model', () => {
  const output = execFileSync(process.execPath, ['--input-type=commonjs', '-e', 'const count = 1; if (true) { const count = 2; } console.log(count);'], { encoding:'utf8', timeout:5000 });
  assert.equal(output.trim(), '1');
});
