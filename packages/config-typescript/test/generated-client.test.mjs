import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);

test('database typecheck generates its client on a clean checkout and restores it from cache', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-generated-client-'));
  const database = path.join(directory, 'packages/database');
  try {
    await mkdir(database, { recursive: true });
    await mkdir(path.join(directory, 'packages/ui'), { recursive: true });
    const { packageManager } = JSON.parse(await readFile(new URL('package.json', root)));
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ name: 'generation-fixture', private: true, packageManager }),
    );
    await writeFile(path.join(directory, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await writeFile(
      path.join(directory, 'pnpm-lock.yaml'),
      "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/database: {}\n  packages/ui: {}\n",
    );
    await writeFile(path.join(directory, '.gitignore'), 'dist/\nsrc/generated/\n.turbo/\n');
    await writeFile(
      path.join(directory, 'turbo.json'),
      await readFile(new URL('turbo.json', root)),
    );
    try {
      await writeFile(
        path.join(database, 'turbo.json'),
        await readFile(new URL('packages/database/turbo.json', root)),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await writeFile(
      path.join(directory, 'packages/ui/package.json'),
      JSON.stringify({ name: '@flowboard/ui', private: true }),
    );
    await writeFile(
      path.join(database, 'package.json'),
      JSON.stringify({
        name: '@flowboard/database',
        type: 'module',
        scripts: { build: 'node build.mjs', typecheck: 'node typecheck.mjs' },
      }),
    );
    await writeFile(
      path.join(database, 'build.mjs'),
      [
        "import { mkdir, writeFile } from 'node:fs/promises';",
        "await mkdir('src/generated', { recursive: true });",
        "await mkdir('dist', { recursive: true });",
        "await writeFile('src/generated/client.ts', 'export type Client = string;');",
        "await writeFile('dist/index.js', 'export {};');",
      ].join('\n'),
    );
    await writeFile(
      path.join(database, 'typecheck.mjs'),
      "import { access } from 'node:fs/promises';\nawait access('src/generated/client.ts');\n",
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('node_modules/turbo/bin/turbo', root)),
          'run',
          'typecheck',
          '--filter=@flowboard/database',
          '--cache=local:rw',
        ],
        { cwd: directory, encoding: 'utf8', timeout: 30_000 },
      );
    const cold = run();
    assert.equal(cold.status, 0, cold.stdout + cold.stderr);
    await rm(path.join(database, 'src/generated'), { recursive: true });
    await rm(path.join(database, 'dist'), { recursive: true });
    const warm = run();
    assert.equal(warm.status, 0, warm.stdout + warm.stderr);
    assert.match(warm.stdout + warm.stderr, /cache hit/);
    assert.match(await readFile(path.join(database, 'src/generated/client.ts'), 'utf8'), /Client/);
    assert.match(await readFile(path.join(database, 'dist/index.js'), 'utf8'), /export/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
