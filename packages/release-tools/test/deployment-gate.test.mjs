import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

for (const [name, env] of [
  ['disabled deployment', { CD_ENABLED: 'false', GITHUB_REF: 'refs/heads/main' }],
  ['pull request deployment', { CD_ENABLED: 'true', GITHUB_REF: 'refs/pull/2/merge' }],
])
  test(`production CLI refuses ${name} before contacting providers`, () => {
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
    assert.match(result.stderr, /Production deployment is not enabled/);
  });
