import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { ESLint } from 'eslint';

import next from '../src/next.mjs';
import node from '../src/node.mjs';
import react from '../src/react.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
async function inspect(code, file = 'apps/api/src/quality-fixture.ts', config = node, fix = false) {
  const eslint = new ESLint({ cwd: root, fix, overrideConfig: config, overrideConfigFile: true });
  const [result] = await eslint.lintText(code, { filePath: file });
  assert.ok(!result.messages.some((message) => message.fatal), JSON.stringify(result.messages));
  return result;
}
const hasRule = (result, rule) => result.messages.some((message) => message.ruleId === rule);

test('all presets reject CommonJS loading, exports and createRequire bridges', async () => {
  for (const [config, file] of [
    [node, 'apps/api/src/esm-fixture.js'],
    [react, 'packages/ui/src/esm-fixture.jsx'],
    [next, 'apps/web/app/esm-fixture.tsx'],
  ]) {
    for (const code of [
      "const value = require('node:path');",
      'module.exports = {};',
      'exports.value = 1;',
    ]) {
      assert.ok(hasRule(await inspect(code, file, config), 'import-x/no-commonjs'), code);
    }
    assert.ok(
      hasRule(
        await inspect("import { createRequire } from 'node:module';", file, config),
        'no-restricted-imports',
      ),
    );
    assert.ok(
      hasRule(
        await inspect(
          "import module from 'node:module'; export const load = module.createRequire(import.meta.url);",
          file,
          config,
        ),
        'no-restricted-imports',
      ),
    );
    assert.equal((await inspect('export const value = 1;', file, config)).errorCount, 0);
  }
});

test('type names use PascalCase while contract property names keep camelCase', async () => {
  const bad = await inspect('export type task_shape = { statusId: string };');
  assert.ok(hasRule(bad, '@typescript-eslint/naming-convention'));
  const good = await inspect('export type TaskShape = { statusId: string };');
  assert.equal(good.errorCount, 0);
});

test('unused imports are removed without removing explicit side-effect imports', async () => {
  const result = await inspect(
    "import 'instrumentation';\nimport { join } from 'node:path';\nexport const value = 1;",
    undefined,
    node,
    true,
  );
  assert.ok(!result.output.includes('{ join }'));
  assert.ok(result.output.includes("import 'instrumentation'"));
});

test('SonarJS catches identical expressions', async () => {
  assert.ok(
    hasRule(
      await inspect('export const equal = (value: boolean) => value && value;'),
      'sonarjs/no-identical-expressions',
    ),
  );
});

test('type members and plain object properties sort consistently', async () => {
  const result = await inspect(
    'export type Task = { zebra: string; alpha: string }; export const task = { zebra: 1, alpha: 2 };',
  );
  assert.ok(hasRule(result, 'perfectionist/sort-object-types'));
  assert.ok(hasRule(result, 'perfectionist/sort-objects'));
});

test('sorting preserves runtime effects, computed/default bindings and overload order', async () => {
  for (const code of [
    'declare function next(): number; export const value = { zebra: next(), alpha: next() };',
    'export function read({ zebra = 1, alpha = zebra }) { return alpha; }',
    'declare const key: string; declare const input: Record<string, number>; export const { [key]: value, alpha } = input;',
    'export const { zebra, alpha } = { get zebra() { return 1; }, get alpha() { return 2; } };',
  ]) {
    const result = await inspect(code, undefined, node, true);
    assert.ok(!hasRule(result, 'perfectionist/sort-objects'));
    assert.equal(result.output, undefined);
  }
  const overloads =
    'export interface Parser { parse(input: string): string; parse(input: unknown): unknown; }';
  const result = await inspect(overloads, undefined, node, true);
  assert.equal(result.output, undefined);
  for (const code of [
    'export type Parser = { (zebra: string): string; (alpha: unknown): unknown };',
    'export interface Factory { new (zebra: string): string; new (alpha: unknown): unknown; }',
  ])
    assert.equal((await inspect(code, undefined, node, true)).output, undefined);
});

test('literal properties sort while destructuring and positional parameters stay ordered', async () => {
  const result = await inspect(
    'export const { zebra, alpha } = { zebra: 1, alpha: 2 };',
    undefined,
    node,
    true,
  );
  assert.match(result.output, /\{ zebra, alpha \}/);
  assert.match(result.output, /\{ alpha: 2, zebra: 1 \}/);
  const positional =
    'export function pair(zebra: string, alpha: string) { return [zebra, alpha]; }';
  assert.equal((await inspect(positional, undefined, node, true)).output, undefined);
});

test('sorting preserves tagged-template and coercion calls and inherited binding reads', async () => {
  const fixtures = [
    'const trace = []; function tag([value]) { trace.push(value); return value; } const object = { zebra: tag`zebra`, alpha: tag`alpha` }; JSON.stringify([trace, object]);',
    'let counter = 0; const source = { valueOf() { return ++counter; } }; const object = { zebra: +source, alpha: +source }; JSON.stringify(object);',
    'const trace = []; Object.defineProperties(Object.prototype, { zebra: { get() { trace.push("zebra"); return 1; } }, alpha: { get() { trace.push("alpha"); return 2; } } }); const { zebra, alpha } = {}; JSON.stringify([trace, zebra, alpha]);',
  ];
  for (const code of fixtures) {
    const result = await inspect(code, undefined, node, true);
    const fixed = result.output ?? code;
    assert.equal(runInNewContext(fixed), runInNewContext(code));
    assert.equal(result.output, undefined);
  }
});

test('React props sort without moving effectful expressions or JSX spreads', async () => {
  const file = 'packages/ui/src/quality-fixture.tsx';
  assert.ok(
    hasRule(
      await inspect('export const Card = () => <Widget zebra="z" alpha="a" />;', file, react),
      'perfectionist/sort-jsx-props',
    ),
  );
  const effectful = 'export const Card = () => <Widget zebra={next()} alpha={next()} />;';
  assert.equal((await inspect(effectful, file, react, true)).output, undefined);
  const spread = 'export const Card = () => <Widget zebra="z" {...props} alpha="a" />;';
  assert.equal((await inspect(spread, file, react, true)).output, undefined);
  for (const expression of ['tag`value`', '+source']) {
    const code = `export const Card = () => <Widget zebra={${expression}} alpha={${expression}} />;`;
    assert.equal((await inspect(code, file, react, true)).output, undefined);
  }
  const css = 'export const Card = () => <div style={{ marginTop: 1, margin: 0 }} />;';
  assert.equal((await inspect(css, file, react, true)).output, undefined);
});

test('React accessibility and JSX usage work with unused-import detection', async () => {
  const bad = await inspect(
    'export const Card = () => <img src="/image.png" />;',
    'packages/ui/src/quality-fixture.tsx',
    react,
  );
  assert.ok(hasRule(bad, 'jsx-a11y/alt-text'));
  const used = await inspect(
    "import { Fragment } from 'react'; export const Card = () => <Fragment>text</Fragment>;",
    'packages/ui/src/quality-fixture.tsx',
    react,
  );
  assert.ok(!hasRule(used, 'unused-imports/no-unused-imports'));
});

test('JSON keys sort while package manifests preserve all key and array order', async () => {
  const sorted = await inspect(
    '{"zebra":1,"alpha":2}',
    'packages/contracts/settings.json',
    node,
    true,
  );
  assert.deepEqual(Object.keys(JSON.parse(sorted.output)), ['alpha', 'zebra']);
  const manifest =
    '{"name":"fixture","exports":{".":{"types":"a.d.ts","import":"a.js","default":"b.js"}},"scripts":{"zebra":"z","alpha":"a"},"files":["z","a"]}';
  const result = await inspect(manifest, 'packages/contracts/package.json', node, true);
  const parsed = JSON.parse(result.output ?? manifest);
  assert.deepEqual(Object.keys(parsed.scripts), ['zebra', 'alpha']);
  assert.deepEqual(Object.keys(parsed.exports['.']), ['types', 'import', 'default']);
  assert.deepEqual(parsed.files, ['z', 'a']);
  assert.equal(result.output, undefined);
});

test('root configuration lints bootstrap TypeScript JSON without JavaScript rules', async () => {
  const eslint = new ESLint({ cwd: root });
  const [result] = await eslint.lintText('{"zebra":1,"alpha":2,"zebra":3}', {
    filePath: 'packages/config-typescript/base.json',
  });
  assert.ok(hasRule(result, 'jsonc/sort-keys'));
  assert.ok(hasRule(result, 'jsonc/no-dupe-keys'));
  assert.ok(!result.messages.some((message) => message.fatal));
});

test('JSON rejects trailing commas that JSONC accepts', async () => {
  assert.ok((await inspect('{"alpha":1,}', 'settings.json')).errorCount > 0);
  assert.equal((await inspect('{"alpha":1,}', 'settings.jsonc')).errorCount, 0);
});
