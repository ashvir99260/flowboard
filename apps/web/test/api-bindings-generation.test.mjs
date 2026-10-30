import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('generated UI bindings expose typed operation hooks and preserve deterministic output', async () => {
  const file = new URL('../src/generated/apiHooks.gen.ts', import.meta.url);
  const before = await readFile(file, 'utf8');
  assert.match(before, /useGetNodeQuery/);
  assert.match(before, /useListTasksInfiniteQuery/);
  assert.match(before, /useCreateTaskMutation/);
  assert.doesNotMatch(
    before,
    /export function use(?:LogIn|LogOut|RefreshSession|SwitchWorkspace|SignUp)Mutation/,
  );
  assert.doesNotMatch(before, /\.get\(|\.post\(|fetch\(/);
  const result = spawnSync(process.execPath, ['scripts/generate-api-bindings.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('binding drift check rejects changed output without overwriting it', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-ui-bindings-'));
  try {
    const target = path.join(directory, 'apiHooks.gen.ts');
    await writeFile(target, '// deliberately stale\n');
    const result = spawnSync(
      process.execPath,
      ['scripts/generate-api-bindings.mjs', '--check', `--target=${target}`],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 15_000,
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Generated UI API bindings drifted/);
    assert.equal(await readFile(target, 'utf8'), '// deliberately stale\n');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('new Hey operations generate bindings automatically and missing keys fail closed', async () => {
  const { readApiInventory, renderApiBindings } = await import('../scripts/api-bindings.mjs');
  const { mkdir } = await import('node:fs/promises');
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-ui-inventory-'));
  try {
    await mkdir(path.join(directory, '@tanstack'));
    const source = path.join(directory, '@tanstack/react-query.gen.ts');
    await writeFile(
      source,
      `
      export const getWidgetQueryKey = () => [];
      export const getWidgetOptions = () => queryOptions({});
      export const saveWidgetMutationKey = () => [];
      export const saveWidgetMutation = () => ({ mutationFn: async () => ({}) });
    `,
    );
    await writeFile(
      path.join(directory, 'types.gen.ts'),
      `
      export type GetWidgetResponse = {};
      export type GetWidgetError = {};
      export type SaveWidgetResponse = {};
      export type SaveWidgetError = {};
    `,
    );
    const output = renderApiBindings(await readApiInventory(directory));
    assert.match(output, /export function useGetWidgetQuery/);
    assert.match(output, /export function useSaveWidgetMutation/);
    await writeFile(source, 'export const getWidgetOptions = () => queryOptions({});');
    await assert.rejects(readApiInventory(directory), /Incomplete generated API operation/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('generated mutation hooks bind the session client, scoped key and common execution policy', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--import',
      './test/common/source-loader.mjs',
      '--input-type=module',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      input: `
        import assert from 'node:assert/strict';
        import { createElement } from 'react';
        import { renderToString } from 'react-dom/server';
        import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
        import { useArchiveNodeMutation } from './src/generated/apiHooks.gen.ts';
        const queryClient = new QueryClient();
        const calls = [];
        const client = {
          getConfig: () => ({ baseUrl: 'https://example.test' }),
          delete: async (options) => { calls.push(options); return { data: undefined }; },
        };
        const scope = { revision: 8, userId: 'alice', workspaceId: 'workspace-a' };
        let hook;
        function Harness() { hook = useArchiveNodeMutation({ runtime: { client }, scope }, { retry: true, mutationKey: ['unsafe'], mutationFn: () => { throw new Error('wrong function'); } }); return null; }
        renderToString(createElement(QueryClientProvider, { client: queryClient }, createElement(Harness)));
        try {
          onlineManager.setOnline(false);
          await hook.mutateAsync({ path: { nodeId: 'node-a' }, body: { expectedVersion: 1, expectedConfigVersion: 2 }, client: { delete: () => { throw new Error('wrong client'); } } });
          assert.equal(calls.length, 1);
          assert.equal(calls[0].path.nodeId, 'node-a');
          assert.equal(calls[0].throwOnError, true);
          const mutation = queryClient.getMutationCache().getAll()[0];
          assert.equal(mutation.options.mutationKey[0]._id, 'archiveNode');
          assert.ok(mutation.options.mutationKey[0].tags.some(tag => tag.includes('workspace-a')));
          assert.equal(mutation.options.retry, false);
          assert.equal(mutation.options.networkMode, 'always');
        } finally { onlineManager.setOnline(true); queryClient.clear(); }
      `,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('binding generation handles operation suffixes and rejects imported-name collisions', async () => {
  const { mkdir } = await import('node:fs/promises');
  const { readApiInventory, renderApiBindings } = await import('../scripts/api-bindings.mjs');
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-ui-names-'));
  try {
    await mkdir(path.join(directory, '@tanstack'));
    await writeFile(
      path.join(directory, '@tanstack/react-query.gen.ts'),
      `
      export const getWidgetInfiniteQueryKey = () => [];
      export const getWidgetInfiniteOptions = () => queryOptions({});
      export const saveWidgetMutationKey = () => [];
      export const saveWidgetMutation = () => ({ mutationFn: async () => ({}) });
    `,
    );
    await writeFile(
      path.join(directory, 'types.gen.ts'),
      `
      export type GetWidgetInfiniteResponse = {};
      export type GetWidgetInfiniteError = {};
      export type SaveWidgetResponse = {};
      export type SaveWidgetError = {};
    `,
    );
    const output = renderApiBindings(await readApiInventory(directory));
    assert.match(output, /export function useGetWidgetInfiniteQuery/);
    assert.throws(
      () =>
        renderApiBindings([
          {
            id: 'useApi',
            key: 'useApiMutationKey',
            kind: 'mutation',
            name: 'useApiMutation',
            title: 'UseApi',
          },
        ]),
      /name collision/,
    );
    await writeFile(path.join(directory, 'types.gen.ts'), '');
    await assert.rejects(readApiInventory(directory), /Incomplete generated API operation/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binding checks reject unexpected sibling output and failed writes preserve existing output', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-ui-extra-'));
  try {
    const target = path.join(directory, 'apiHooks.gen.ts');
    const current = await readFile(
      new URL('../src/generated/apiHooks.gen.ts', import.meta.url),
      'utf8',
    );
    await writeFile(target, current);
    await writeFile(path.join(directory, 'unexpected.ts'), 'export {};');
    const checked = spawnSync(
      process.execPath,
      ['scripts/generate-api-bindings.mjs', '--check', `--target=${target}`],
      { cwd: root, encoding: 'utf8', timeout: 15_000 },
    );
    assert.equal(checked.status, 1);
    assert.match(checked.stderr, /unexpected|drifted/);
    const written = spawnSync(
      process.execPath,
      [
        'scripts/generate-api-bindings.mjs',
        '--write',
        `--input=${path.join(directory, 'missing')}`,
        `--target=${target}`,
      ],
      { cwd: root, encoding: 'utf8', timeout: 15_000 },
    );
    assert.equal(written.status, 1);
    assert.equal(await readFile(target, 'utf8'), current);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
