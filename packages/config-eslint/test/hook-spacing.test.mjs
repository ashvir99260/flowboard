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
const rule = 'flowboard/hook-spacing';
async function inspect(
  source,
  {
    config = react,
    file = 'packages/ui/src/hooks/useFixture.ts',
    fix = false,
    extraRules = {},
  } = {},
) {
  const eslint = new ESLint({
    cwd: root,
    fix,
    overrideConfig: [
      ...config,
      {
        rules: {
          'import-x/order': 'off',
          'perfectionist/sort-named-imports': 'off',
          'unused-imports/no-unused-imports': 'off',
          'unused-imports/no-unused-vars': 'off',
          ...extraRules,
        },
      },
    ],
    overrideConfigFile: true,
  });
  const [result] = await eslint.lintText(source, { filePath: file });
  assert.ok(!result.messages.some((message) => message.fatal), JSON.stringify(result.messages));

  return result;
}

const messages = (result) => result.messages.filter((message) => message.ruleId === rule);
const compact = (source) => source.replace(/\s/g, '');

test('line-sensitive trailing directives keep their target and are reported without a fix', async () => {
  for (const directive of [
    '// eslint-disable-next-line no-console',
    '/* eslint-disable-next-line no-console */',
    '// @ts-expect-error',
    '// @ts-ignore',
  ]) {
    const source = `export function useFixture() {\n  const value = useState(0); ${directive}\n  console.log(value);\n}\n`;
    const extraRules = directive.includes('eslint') ? { 'no-console': 'error' } : {};
    const result = await inspect(source, { fix: true, extraRules });
    assert.equal(result.output, undefined);
    assert.equal(messages(result).length, 1);
    assert.ok(result.messages.every((message) => message.ruleId !== 'no-console'));
  }
});

for (const [name, config, file] of [
  ['React TS', react, 'packages/ui/src/hooks/useFixture.ts'],
  ['React TSX', react, 'packages/forms/src/fixture.tsx'],
  ['Next TS', next, 'apps/web/src/features/fixture.ts'],
  ['Next TSX', next, 'apps/web/app/fixture.tsx'],
]) {
  test(`${name} separates hook groups and individual effects`, async () => {
    const source = `import { useEffect, useRef, useState } from 'react';
export function useFixture() {
  before();
  const [value] = useState(0);
  const ref = useRef(value);
  useEffect(() => consume(ref), [ref]);
  useEffect(() => consume(value), [value]);
  after();
  return value;
}
`;
    assert.equal(messages(await inspect(source, { config, file })).length, 4);
    const result = await inspect(source, { config, file, fix: true });
    assert.equal(compact(result.output), compact(source));
    assert.ok(result.output.includes('before();\n\n  const [value]'));
    assert.ok(result.output.includes('useState(0);\n  const ref'));
    assert.ok(result.output.includes('useRef(value);\n\n  useEffect'));
    assert.equal(messages(result).length, 0);
    assert.equal((await inspect(result.output, { config, file, fix: true })).output, undefined);
    const formatted = await format(result.output, { parser: 'typescript', singleQuote: true });
    assert.equal((await inspect(formatted, { config, file, fix: true })).output, undefined);
  });

  test(`${name} keeps upstream hook correctness checks active`, async () => {
    const conditional = await inspect(
      "import { useState } from 'react';\nexport function useFixture(ready: boolean) { if (ready) { useState(0); } }\n",
      { config, file },
    );
    assert.ok(
      conditional.messages.some((message) => message.ruleId === 'react-hooks/rules-of-hooks'),
    );
    const dependencies = await inspect(
      "import { useEffect } from 'react';\nexport function useFixture(value: number) { useEffect(() => consume(value), []); }\n",
      { config, file },
    );
    assert.ok(
      dependencies.messages.some((message) => message.ruleId === 'react-hooks/exhaustive-deps'),
    );
  });
}

test('scope-resolved aliases and React namespaces receive spacing without leaking into shadowed scopes', async () => {
  const source = `import R, { useEffect as observe, useState as state } from 'react';
export function useFixture() {
  before();
  const value = state(0);
  observe(() => consume(value), [value]);
  const ref = R.useRef(value);
  after();
}
`;
  assert.equal(messages(await inspect(source)).length, 4);
  for (const source of [
    "import { useEffect as observe } from 'react';\nexport function run(observe: Function) { before(); observe(); after(); }\n",
    "import * as R from 'react';\nexport function run(R: any) { before(); R.useState(); after(); }\n",
    'export function run(store: any) { before(); store.useState(); after(); }\n',
  ]) {
    assert.equal(messages(await inspect(source)).length, 0);
  }
});

test('custom value hooks stay grouped and callback statements are not mistaken for outer hooks', async () => {
  const source = `export function useFixture() {
  const first = useFirst();
  const second = useSecond(first);
  const cached = useMemo(() => { const a = read(); consume(a); return a; }, []);
  consume(second, cached);
}
`;
  const result = await inspect(source, { fix: true });
  assert.ok(result.output.includes('useFirst();\n  const second'));
  assert.ok(result.output.includes('useSecond(first);\n  const cached'));
  assert.ok(result.output.includes('const a = read(); consume(a);'));
  assert.ok(result.output.includes('}, []);\n\n  consume'));
  assert.equal(compact(result.output), compact(source));
});

test('comments stay attached and internal comment lines do not count as statement padding', async () => {
  const source = `export function useFixture() {
  before(); // trailing
  /** Hook documentation\n   *\n   * More details. */
  const state = useState(0); // hook trailing
  // Next operation.
  after(state);
}
`;
  const result = await inspect(source, { fix: true });
  assert.ok(result.output.includes('before(); // trailing\n\n  /** Hook'));
  assert.ok(result.output.includes('useState(0); // hook trailing\n\n  // Next'));
  assert.equal(compact(result.output), compact(source));
  assert.equal(messages(await inspect(result.output)).length, 0);
});

test('same-line, CRLF and protective semicolons preserve evaluation order', async () => {
  for (const source of [
    'function useFixture() { before(); const value = useState(0); after(value); } useFixture();',
    'function useFixture() {\r\n  before();\r\n  const value = useState(0);\r\n  after(value);\r\n}\r\nuseFixture();',
    'function useFixture() {\n  const value = useState(0)\n  ;[value].forEach(consume);\n}\nuseFixture();',
  ]) {
    const fixed = (await inspect(source, { fix: true })).output;
    assert.equal(typeof fixed, 'string');
    assert.equal(compact(fixed), compact(source));
    const trace = (code) => {
      const events = [];
      runInNewContext(code, {
        after: (value) => events.push(['after', value]),
        before: () => events.push(['before']),
        consume: (value) => events.push(['consume', value]),
        useState: (value) => {
          events.push(['hook', value]);

          return value;
        },
      });

      return events;
    };
    assert.deepEqual(trace(fixed), trace(source));
    assert.equal(messages(await inspect(fixed)).length, 0);
  }
});

test('generic wrappers, mixed declarations and standalone custom hooks isolate whole statements', async () => {
  const source = `export function useFixture() {
  before();
  const first = (useFirst<string>() as string), second = read();
  useSubscription(first);
  after(second);
}
`;
  const result = await inspect(source, { fix: true });
  assert.equal(messages(await inspect(source)).length, 3);
  assert.equal(compact(result.output), compact(source));
  assert.ok(result.output.includes('second = read();\n\n  useSubscription'));
});

test('first and last hook statements do not pad their braces and Node stays unaffected', async () => {
  const source = 'export function useFixture() {\n  const value = useState(0);\n}\n';
  assert.equal(messages(await inspect(source)).length, 0);
  const backend = 'export function useFixture() { before(); useEffect(run, []); after(); }\n';
  assert.equal(
    messages(await inspect(backend, { config: node, file: 'apps/api/src/fixture.ts' })).length,
    0,
  );
});
