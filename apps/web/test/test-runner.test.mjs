import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const launcher = fileURLToPath(new URL('../scripts/test.mjs', import.meta.url));

test('web runner executes every file once with separate bounded budgets and propagates either failure', async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'flowboard-runner-'));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  await mkdir(path.join(cwd, 'test'));
  await mkdir(path.join(cwd, 'e2e'));
  await Promise.all(
    ['first.spec.ts', 'second.spec.ts'].map((file) => writeFile(path.join(cwd, 'e2e', file), '')),
  );
  for (const [file, label, timeout] of [
    ['first.test.mjs', 'first', 60000],
    ['second.test.mjs', 'second', 60000],
    ['real-e2e.test.mjs', 'journeys', 390000],
  ])
    await writeFile(
      path.join(cwd, 'test', file),
      `
    import assert from 'node:assert/strict';
    import { appendFileSync } from 'node:fs';
    import test from 'node:test';
    test(${JSON.stringify(label)}, () => {
      appendFileSync('executed', ${JSON.stringify(label + '\n')});
      assert.ok(process.execArgv.includes('--test-timeout=${timeout}'));
      assert.ok(process.execArgv.includes('--test-concurrency=1'));
      assert.ok(process.execArgv.includes('--conditions=react-server'));
      assert.notEqual(process.env.FLOWBOARD_RUNNER_FAILURE, ${JSON.stringify(label)});
    });
  `,
    );
  for (const failure of ['', 'first', 'journeys']) {
    await writeFile(path.join(cwd, 'executed'), '');
    const env = { ...process.env, FLOWBOARD_RUNNER_FAILURE: failure };
    delete env.NODE_TEST_CONTEXT;
    const result = await promisify(execFile)(process.execPath, [launcher], {
      cwd,
      env,
    }).then(
      () => 0,
      (error) => error.code,
    );
    assert.equal(result, failure ? 1 : 0);
    assert.deepEqual(
      (await readFile(path.join(cwd, 'executed'), 'utf8')).trim().split('\n').sort(),
      ['first', 'journeys', 'second'],
    );
  }
});
