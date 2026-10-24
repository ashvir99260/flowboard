import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

for (const mode of ['--write', '--check']) {
  test(`missing input cannot report successful generation with ${mode}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flowboard-invalid-client-'));
    try {
      const client = join(directory, 'client');
      await mkdir(join(client, 'scripts'), { recursive: true });
      await mkdir(join(client, 'src/generated'), { recursive: true });
      await mkdir(join(directory, 'openapi'));
      for (const file of ['package.json', 'openapi-ts.config.mjs', 'scripts/generate.mjs']) {
        await copyFile(join(root, file), join(client, file));
      }
      await symlink(join(root, 'node_modules'), join(client, 'node_modules'), 'dir');
      const result = spawnSync(process.execPath, ['scripts/generate.mjs', mode], {
        cwd: client,
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env, JITI_FS_CACHE: 'false', TMPDIR: directory },
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /API client generation did not complete/);
      assert.deepEqual(await readdir(join(client, 'src/generated')), []);
      assert.deepEqual((await readdir(directory)).sort(), ['client', 'openapi']);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}
