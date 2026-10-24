import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  appendFile,
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const generated = join(root, 'src/generated');
const script = join(root, 'scripts/generate.mjs');
const document = fileURLToPath(new URL('../../openapi/openapi.json', import.meta.url));

async function snapshot(directory, prefix = '') {
  const entries = await readdir(join(directory, prefix), { withFileTypes: true });
  const records = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(prefix, entry.name);
    records.push(
      ...(entry.isDirectory()
        ? await snapshot(directory, path)
        : [
            [
              path,
              createHash('sha256')
                .update(await readFile(join(directory, path)))
                .digest('hex'),
            ],
          ]),
    );
  }

  return records;
}

for (const change of ['default', 'unchanged', 'changed', 'missing', 'extra']) {
  test(`client check detects ${change} output from another working directory without writing sources`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flowboard-client-drift-'));
    try {
      const target = join(directory, 'expected');
      await cp(generated, target, { recursive: true });
      if (change === 'changed') await appendFile(join(target, 'types.gen.ts'), '\n// drift\n');

      if (change === 'missing') await rm(join(target, 'types.gen.ts'));

      if (change === 'extra') await writeFile(join(target, 'unexpected.ts'), 'export {};\n');

      const before = await snapshot(target);
      const sources = await snapshot(join(root, 'src'));
      const spec = await readFile(document);
      const result = spawnSync(
        process.execPath,
        [script, '--check', ...(change === 'default' ? [] : [`--target=${target}`])],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 60_000,
          env: { ...process.env, JITI_FS_CACHE: 'false', TMPDIR: directory },
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, ['default', 'unchanged'].includes(change) ? 0 : 1, result.stderr);
      if (!['default', 'unchanged'].includes(change))
        assert.match(result.stderr, /Generated API client.*drifted/);

      assert.deepEqual(await snapshot(target), before);
      assert.deepEqual(await snapshot(join(root, 'src')), sources);
      assert.deepEqual(await readFile(document), spec);
      assert.deepEqual(await readdir(directory), ['expected']);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}

test('normal build leaves source artifacts untouched and emits public modules into ignored dist', async () => {
  const sources = await snapshot(join(root, 'src'));
  const spec = await readFile(document);
  const result = spawnSync('pnpm', ['build'], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(await snapshot(join(root, 'src')), sources);
  assert.deepEqual(await readFile(document), spec);
  for (const path of [
    'index.js',
    'index.d.ts',
    'generated/sdk.gen.js',
    'generated/types.gen.d.ts',
    'generated/@tanstack/react-query.gen.js',
  ]) {
    await access(join(root, 'dist', path));
  }
  const ignored = spawnSync('git', ['check-ignore', 'dist/index.js'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(ignored.status, 0, ignored.stderr);
});

test('client check remains package-owned and uncached in the Turbo graph', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const repositoryManifest = JSON.parse(await readFile(join(root, '../../package.json'), 'utf8'));
  const turbo = JSON.parse(await readFile(join(root, 'turbo.json'), 'utf8'));
  assert.equal(repositoryManifest.scripts['client:check'], 'turbo run client:check');
  assert.equal(manifest.scripts['client:check'], 'node scripts/generate.mjs --check');
  assert.equal(turbo.tasks['client:check'].cache, false);
  assert.deepEqual(turbo.tasks['client:check'].dependsOn, ['^build']);
});
