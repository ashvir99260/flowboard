import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);
const workspaces = [
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/contracts',
  'packages/database',
  'packages/openapi',
  'packages/api-client',
  'packages/ui',
  'packages/config-typescript',
  'packages/config-eslint',
  'packages/config-jest',
  'packages/config-prettier',
  'packages/release-tools',
];

const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('root commands delegate to Turbo and pin the local package manager', async () => {
  const manifest = await json('package.json');
  assert.equal(manifest.private, true);
  assert.match(manifest.packageManager, /^pnpm@\d+\.\d+\.\d+$/);
  for (const command of ['build', 'lint', 'test', 'typecheck', 'format', 'format:check']) {
    assert.equal(manifest.scripts[command], `turbo run ${command}`);
  }
  const workspace = await readFile(new URL('pnpm-workspace.yaml', root), 'utf8');
  assert.match(workspace, /apps\/\*/);
  assert.match(workspace, /packages\/\*/);
});

test('every workspace exports a focused package with build, lint and formatting commands', async () => {
  for (const path of workspaces) {
    const manifest = await json(`${path}/package.json`);
    assert.match(manifest.name, /^@flowboard\//, path);
    assert.equal(manifest.private, true, path);
    assert.ok(manifest.exports, `${path}: public exports`);
    for (const command of ['build', 'lint', 'typecheck', 'format', 'format:check']) {
      assert.ok(manifest.scripts[command], `${path}: ${command}`);
    }
    assert.equal(manifest.prettier, '@flowboard/config-prettier', path);
    const tsconfig = await json(`${path}/tsconfig.json`);
    assert.ok(tsconfig.extends, `${path}: shared compiler settings`);
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      assert.ok(
        !['@flowboard/api', '@flowboard/web', '@flowboard/worker'].includes(dependency),
        path,
      );
    }
  }
});

test('compiler presets separate browser and Node resolution without weakening strictness', async () => {
  const base = await json('packages/config-typescript/base.json');
  const node = await json('packages/config-typescript/node.json');
  const next = await json('packages/config-typescript/next.json');
  assert.equal(base.compilerOptions.strict, true);
  assert.equal(base.compilerOptions.noUncheckedIndexedAccess, true);
  assert.equal(node.compilerOptions.module, 'NodeNext');
  assert.equal(node.compilerOptions.moduleResolution, 'NodeNext');
  assert.equal(next.compilerOptions.moduleResolution, 'Bundler');
  assert.equal(next.compilerOptions.noEmit, true);
});

test('Turbo caches produced output and does not cache long-running development processes', async () => {
  const { tasks } = await json('turbo.json');
  assert.deepEqual(tasks.build.dependsOn, ['^build']);
  assert.ok(tasks.build.outputs.includes('dist/**'));
  assert.equal(tasks.dev.cache, false);
  assert.equal(tasks.dev.persistent, true);
  assert.equal(tasks.test.cache, false);
  assert.equal(tasks.format.cache, false);
  assert.equal(tasks['format:check'].cache, false);
});

test('package exports reference configuration or sources emitted by their build', async () => {
  const values = (value) =>
    typeof value === 'string' ? [value] : Object.values(value).flatMap(values);
  for (const path of workspaces) {
    const manifest = await json(`${path}/package.json`);
    const targets = values(manifest.exports);
    for (const target of targets) {
      const source = target.replace('./dist/', './src/').replace(/\.(?:d\.ts|js)$/, '.ts');
      const resolved = new URL(`${path}/${source}`, root);
      try {
        await readFile(resolved);
      } catch {
        assert.fail(`${fileURLToPath(resolved)} is missing for export ${target}`);
      }
    }
  }
});
