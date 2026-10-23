import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: root, fix: true });
const rule = 'flowboard/require-exact-dependency-versions';
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
async function inspect(manifest, filePath = 'package.json') {
  const [result] = await eslint.lintText(JSON.stringify(manifest), { filePath });
  assert.ok(!result.messages.some((message) => message.fatal), JSON.stringify(result.messages));

  return result;
}

test('manifest lint rejects dependency ranges without choosing replacement versions', async () => {
  for (const section of sections) {
    const result = await inspect({ [section]: { react: '^19.3.1' } });
    assert.ok(result.messages.some((message) => message.ruleId === rule));
    assert.equal(result.output, undefined);
  }
});

test('exact versions, prereleases, build metadata and workspace references are accepted', async () => {
  const values = [
    '0.0.0',
    '1.2.3',
    '1.2.3-beta.1',
    '1.2.3+build.01',
    '1.2.3-rc.1+sha.abc',
    'workspace:*',
  ];
  for (const section of sections) {
    const result = await inspect({
      [section]: Object.fromEntries(values.map((value, index) => [`package-${index}`, value])),
      engines: { node: '>=22.13.0 <23' },
    });
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
    assert.equal(result.output, undefined);
  }
});

test('floating, noncanonical and alternate-source dependencies are rejected', async () => {
  const values = [
    '~1.2.3',
    '>=1.2.3',
    '1',
    '1.2',
    '1.x',
    '*',
    'latest',
    'next',
    '',
    '1.2.3 || 2.0.0',
    '1.2.3 - 2.0.0',
    'v1.2.3',
    '=1.2.3',
    ' 1.2.3 ',
    '1.2.3\n',
    '01.2.3',
    '1.2.3-01',
    'workspace:^',
    'workspace:~',
    'file:../local',
    'link:../local',
    'npm:react@19.3.1',
    'git+https://github.com/example/package.git#main',
    'https://example.com/package.tgz',
    null,
    123,
    true,
    {},
    [],
  ];
  const result = await inspect({
    dependencies: Object.fromEntries(values.map((value, index) => [`package-${index}`, value])),
  });
  assert.equal(result.messages.filter((message) => message.ruleId === rule).length, values.length);
  assert.equal(result.output, undefined);
});

test('malformed dependency sections fail instead of bypassing version validation', async () => {
  for (const section of sections) {
    for (const value of [null, [], '1.2.3']) {
      const result = await inspect({ [section]: value });
      assert.equal(result.messages.filter((message) => message.ruleId === rule).length, 1);
    }
  }
});

test('root and app/package manifests share the policy without reordering any keys', async () => {
  for (const file of [
    'package.json',
    'apps/api/package.json',
    'apps/web/package.json',
    'packages/ui/package.json',
    'packages/config-typescript/package.json',
  ]) {
    const good = await inspect(
      {
        scripts: { alpha: 'a', zebra: 'z' },
        dependencies: { alpha: 'workspace:*', zebra: '1.2.3' },
        exports: { '.': { default: './index.js', import: './index.js', types: './index.d.ts' } },
        files: ['z', 'a'],
        name: 'fixture',
      },
      file,
    );
    assert.equal(good.errorCount, 0, JSON.stringify(good.messages));
    assert.equal(good.output, undefined);
    const bad = await inspect({ dependencies: { zebra: 'latest' } }, file);
    assert.equal(bad.messages.filter((message) => message.ruleId === rule).length, 1);
  }
});

test('nested example settings are not dependency declarations', async () => {
  const result = await inspect({ config: { dependencies: { example: '^1.0.0' } } });
  assert.equal(result.errorCount, 0);
});

test('escaped root keys are validated and strict manifest JSON checks stay enabled', async () => {
  const checkOnly = new ESLint({ cwd: root });
  const [escaped] = await eslint.lintText('{"depend\\u0065ncies":{"react":"^19.3.1"}}', {
    filePath: 'package.json',
  });
  assert.equal(escaped.messages.filter((message) => message.ruleId === rule).length, 1);
  for (const text of ['{"name":"a","name":"b"}', '{"name":"a",}']) {
    const [result] = await checkOnly.lintText(text, { filePath: 'package.json' });
    assert.ok(result.errorCount > 0);
  }
});
