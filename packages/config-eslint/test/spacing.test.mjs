import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

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
