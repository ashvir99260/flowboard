import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('client drift check rejects changed generated sources without editing tracked files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowboard-client-drift-'));
  try {
    await cp('src/generated', directory, { recursive: true });
    await appendFile(join(directory, 'types.gen.ts'), '\n// drift\n');
    const result = spawnSync(process.execPath, ['scripts/generate.mjs', `--target=${directory}`], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Generated API client drifted/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
