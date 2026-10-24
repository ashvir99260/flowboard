import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

test('all workspace checks run as independent free-runner jobs before publication', () => {
  const { jobs } = parse(
    readFileSync(new URL('../../../.github/workflows/delivery.yml', import.meta.url), 'utf8'),
  );
  const verify = jobs.verify;
  assert.equal(verify.needs, undefined);
  assert.equal(verify.if, 'github.event.repository.private == false');
  assert.equal(verify.strategy['fail-fast'], false);
  assert.deepEqual(verify.strategy.matrix.command, [
    'build',
    'lint',
    'test',
    'typecheck',
    'format:check',
  ]);
  assert.ok(verify.steps.some((step) => step.run === 'pnpm ${{ matrix.command }}'));
  assert.equal(jobs.containers.needs, undefined);
  assert.equal(jobs.containers.if, 'github.event.repository.private == false');
  assert.equal(jobs.containers.strategy['fail-fast'], false);
  assert.deepEqual(jobs.containers.strategy.matrix.command, ['docker:check', 'docker:dev:check']);
  assert.ok(jobs.containers.steps.some((step) => step.run === 'pnpm ${{ matrix.command }}'));
  assert.ok(
    jobs.containers.steps.some(
      (step) =>
        step.if === "matrix.command == 'docker:check'" &&
        step.run === 'pnpm --filter @flowboard/web exec playwright install --with-deps chromium',
    ),
  );
  assert.deepEqual(jobs.release.needs, ['verify', 'containers']);
  assert.equal(jobs.release['continue-on-error'], undefined);
  assert.equal(jobs.deploy.needs, 'release');
  for (const job of Object.values(jobs)) {
    assert.equal(job['runs-on'], 'ubuntu-24.04');
    assert.equal(job['continue-on-error'], undefined);
  }
});

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

test('commit policy checks event data in the lint leg and reruns on title edits', () => {
  const workflow = parse(
    readFileSync(new URL('../../../.github/workflows/delivery.yml', import.meta.url), 'utf8'),
  );
  assert.ok(workflow.on.pull_request.types.includes('edited'));
  const steps = workflow.jobs.verify.steps;
  assert.equal(steps[0].with['fetch-depth'], 0);
  const commitCheck = steps.find((step) => step.run === 'pnpm commitlint:ci');
  assert.equal(commitCheck.if, "matrix.command == 'lint'");
  assert.ok(!JSON.stringify(commitCheck).includes('pull_request.title'));
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
