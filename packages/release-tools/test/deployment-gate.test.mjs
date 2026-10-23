import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

test('the workflow uses preview secrets and only deploys after main release success', () => {
  const workflow = parse(
    readFileSync(new URL('../../../.github/workflows/delivery.yml', import.meta.url), 'utf8'),
  );
  const job = workflow.jobs.deploy;
  assert.equal(job.environment, 'preview');
  assert.equal(job.needs, 'release');
  assert.match(job.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(job.if, /github.event_name != 'pull_request'/);
  assert.match(job.if, /vars.CD_ENABLED == 'true'/);
  assert.equal(job.concurrency['cancel-in-progress'], false);
  assert.ok(job.steps.some((step) => step.run === 'pnpm deploy:preview'));
});

for (const [name, env] of [
  ['disabled deployment', { CD_ENABLED: 'false', GITHUB_REF: 'refs/heads/main' }],
  ['pull request deployment', { CD_ENABLED: 'true', GITHUB_REF: 'refs/pull/2/merge' }],
])
  test(`preview CLI refuses ${name} before contacting providers`, () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('../dist/deploy-cli.js', import.meta.url))],
      {
        env: {
          ...process.env,
          ...env,
          GITHUB_TOKEN: '',
          VERCEL_TOKEN: '',
          NORTHFLANK_API_TOKEN: '',
        },
        encoding: 'utf8',
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Preview deployment is not enabled/);
  });
