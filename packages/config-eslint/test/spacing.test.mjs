import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { ESLint } from 'eslint';
import { format } from 'prettier';

import next from '../src/next.mjs';
import node from '../src/node.mjs';
import react from '../src/react.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const rule = 'padding-line-between-statements';
async function inspect(code, config = node, file = 'apps/api/src/spacing-fixture.ts', fix = false) {
  const eslint = new ESLint({ cwd: root, fix, overrideConfig: config, overrideConfigFile: true });
  const [result] = await eslint.lintText(code, { filePath: file });
  assert.ok(!result.messages.some((message) => message.fatal), JSON.stringify(result.messages));

  return result;
}

const declarations = [
  'export const first = 1;',
  'export function first() {}',
  'export class First {}',
  'export type First = string;',
  'export interface First { value: string; }',
  "export { first } from './first.js';",
  "export * from './first.js';",
  'export default function first() {}',
];

test('every export form requires a blank line before the following statement', async () => {
  for (const declaration of declarations) {
    const source = `${declaration}\nexport const second = 2;\n`;
    const result = await inspect(source);
    assert.ok(
      result.messages.some((message) => message.ruleId === rule),
      declaration,
    );
    const fixed = await inspect(source, node, undefined, true);
    assert.equal(fixed.output, `${declaration}\n\nexport const second = 2;\n`);
  }
});

test('module spacing preserves decorators and trailing or leading comments', async () => {
  const source =
    "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class FirstModule {} // first module\n/** Next module */\n@Module({})\nexport class SecondModule {}\n";
  const result = await inspect(source, node, undefined, true);
  assert.ok(result.output.includes('FirstModule {} // first module\n\n/** Next module */'));
  assert.ok(result.output.includes('@Module({})\nexport class SecondModule {}'));
  assert.equal(
    (await inspect(result.output)).messages.some((message) => message.ruleId === rule),
    false,
  );
});

test('already spaced exports and final declarations do not gain blank lines', async () => {
  const source = 'export const first = 1;\n\nexport type Second = { value: string };\n';
  const result = await inspect(source, node, undefined, true);
  assert.equal(result.output, undefined);
  for (const declaration of declarations) {
    assert.equal((await inspect(`${declaration}\n`, node, undefined, true)).output, undefined);
  }
});

test('Node React and Next presets retain the rule after Prettier compatibility', async () => {
  for (const [config, file] of [
    [node, 'apps/api/src/spacing-fixture.ts'],
    [react, 'packages/ui/src/spacing-fixture.tsx'],
    [next, 'apps/web/app/spacing-fixture.tsx'],
  ]) {
    const source = 'export const First = () => null;\nexport const Second = () => null;\n';
    const result = await inspect(source, config, file);
    assert.ok(
      result.messages.some((message) => message.ruleId === rule),
      file,
    );
  }
});

test('autofixed module spacing is stable under Prettier and a second lint pass', async () => {
  const source =
    "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class FirstModule {}\n@Module({})\nexport class SecondModule {}\n";
  const fixed = (await inspect(source, node, undefined, true)).output;
  const formatted = await format(fixed, { parser: 'typescript', singleQuote: true });
  assert.equal(formatted, fixed);
  assert.equal((await inspect(formatted, node, undefined, true)).output, undefined);
});

for (const [name, config, file] of [
  ['Node', node, 'apps/api/src/spacing-fixture.ts'],
  ['React', react, 'packages/ui/src/spacing-fixture.tsx'],
  ['Next', next, 'apps/web/app/spacing-fixture.tsx'],
]) {
  test(`${name} separates a guard from the following return`, async () => {
    const source =
      'export function Choose(value: boolean) {\n  if (value) return null;\n  return null;\n}\n';
    const expected =
      'export function Choose(value: boolean) {\n  if (value) return null;\n\n  return null;\n}\n';
    const result = await inspect(source, config, file);
    assert.ok(result.messages.some((message) => message.ruleId === rule));
    assert.equal((await inspect(source, config, file, true)).output, expected);
  });
}

test('spacing follows the whole if/else chain and preserves attached comments', async () => {
  const source = `export function choose(value: number) {
  if (value === 1) {
    return 1;
  } else if (value === 2) {
    return 2;
  } else {
    value = 3;
  } // selected
  // Use the fallback value.
  return value;
}
`;
  const expected = source.replace('} // selected\n', '} // selected\n\n');
  assert.equal((await inspect(source, node, undefined, true)).output, expected);
});

test('a separated multiline return preserves the returned value', async () => {
  const source = `function read() {
  const value = 3;
  return (
    { value }
  );
}
read();
`;
  const expected = source.replace('const value = 3;\n', 'const value = 3;\n\n');
  const fixed = (await inspect(source, node, undefined, true)).output;
  assert.equal(fixed, expected);
  assert.equal(runInNewContext(fixed).value, 3);
});

test('return padding also applies when another statement follows', async () => {
  // Deliberately unreachable input isolates padding from the separate reachability rule.
  const source = 'export function read() {\n  return 1;\n  consume();\n}\n';
  const expected = 'export function read() {\n  return 1;\n\n  consume();\n}\n';
  assert.equal((await inspect(source, node, undefined, true)).output, expected);
});

test('final conditionals and returns do not gain padding before closing braces', async () => {
  for (const source of [
    'export function read() {\n  return 1;\n}\n',
    'export function read(value: boolean) {\n  if (value) {\n    return 1;\n  }\n}\n',
  ]) {
    assert.equal((await inspect(source, node, undefined, true)).output, undefined);
  }
});

test('control-flow fixes remain stable through Prettier, including JSX returns', async () => {
  const source = `export function Choose({ ready }: { ready: boolean }) {
  if (!ready) {
    return <span>Loading</span>;
  }
  const label = 'Ready';
  return <span>{label}</span>;
}
`;
  for (const [config, file] of [
    [react, 'packages/ui/src/spacing-fixture.tsx'],
    [next, 'apps/web/app/spacing-fixture.tsx'],
  ]) {
    const fixed = (await inspect(source, config, file, true)).output;
    assert.equal(typeof fixed, 'string', 'missing control-flow padding must be autofixed');
    assert.ok(fixed.includes("}\n\n  const label = 'Ready';\n\n  return"));
    const formatted = await format(fixed, { parser: 'typescript', singleQuote: true });
    assert.equal(formatted, fixed);
    assert.equal((await inspect(formatted, config, file, true)).output, undefined);
  }
});
