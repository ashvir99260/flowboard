import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';

const files = (await readdir('test')).filter((file) => file.endsWith('.test.mjs')).sort();
const ordinary = files.filter((file) => file !== 'real-e2e.test.mjs');
const journeys = (await readdir('e2e')).filter((file) => file.endsWith('.spec.ts'));
assert.ok(ordinary.length && files.includes('real-e2e.test.mjs') && journeys.length);
const groups = [
  { files: ordinary, timeout: 60_000 },
  { files: ['real-e2e.test.mjs'], timeout: journeys.length * 180_000 + 30_000 },
];
const flags = [
  '--experimental-strip-types',
  '--conditions=react-server',
  '--test',
  '--test-concurrency=1',
];
let child;
let interrupted;
let failed = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    interrupted = signal;
    child?.kill(signal);
  });

for (const group of groups) {
  if (interrupted) break;

  child = spawn(
    process.execPath,
    [...flags, `--test-timeout=${group.timeout}`, ...group.files.map((file) => `test/${file}`)],
    { stdio: 'inherit' },
  );
  const [code] = await once(child, 'exit');
  failed ||= code !== 0;
  child = undefined;
}
process.exitCode = interrupted ? (interrupted === 'SIGINT' ? 130 : 143) : failed ? 1 : 0;
