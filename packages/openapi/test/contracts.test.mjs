import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('spec export needs no runtime dependencies and rejects stale artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-spec-'));
  try {
    const source = JSON.parse(await readFile('openapi.json', 'utf8'));
    source.info.title = 'Stale contract';
    const target = join(directory, 'openapi.json');
    await writeFile(target, JSON.stringify(source));
    const env = { ...process.env };
    for (const name of [
      'DATABASE_URL',
      'DATABASE_URL_UNPOOLED',
      'REDIS_URL',
      'JWT_SECRET',
      'AUTH_SECRET',
      'AUTH_ALLOWED_ORIGINS',
      'AUTH_ALLOW_INSECURE_HTTP',
    ])
      delete env[name];
    const valid = spawnSync(process.execPath, ['scripts/export.mjs', '--check'], {
      encoding: 'utf8',
      env,
    });
    assert.equal(valid.status, 0, valid.stderr);
    const drift = spawnSync(
      process.execPath,
      ['scripts/export.mjs', '--check', `--target=${target}`],
      { encoding: 'utf8', env },
    );
    assert.equal(drift.status, 1);
    assert.match(drift.stderr, /OpenAPI drift detected/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('Spectral rejects unversioned paths, missing IDs, offset paging and untyped errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-spectral-'));
  try {
    const document = JSON.parse(await readFile('openapi.json', 'utf8'));
    document.paths['/tasks'] = {
      get: {
        ...document.paths['/health/live'].get,
        operationId: 'listTasks',
        parameters: [{ in: 'query', name: 'offset', schema: { type: 'integer' } }],
      },
    };
    delete document.paths['/health/ready'].get.operationId;
    document.paths['/health/ready'].get.responses['503'] = { description: 'Missing error schema' };
    const target = join(directory, 'invalid.json');
    await writeFile(target, JSON.stringify(document));
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/@stoplight/spectral-cli/dist/index.js',
        'lint',
        target,
        '--ruleset',
        '.spectral.yaml',
        '--format',
        'json',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1, result.stderr);
    const codes = JSON.parse(result.stdout).map((finding) => finding.code);
    for (const code of [
      'flowboard-versioned-paths',
      'operation-operationId',
      'flowboard-list-cursor',
      'flowboard-cursor-only',
      'flowboard-error-envelope',
    ])
      assert.ok(codes.includes(code), code);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
