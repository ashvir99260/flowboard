import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('API compiles TypeScript imports, re-exports and dynamic imports into executable ESM', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-api-imports-'));
  try {
    await mkdir(path.join(directory, 'src'));
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(
      path.join(directory, 'src/value.ts'),
      'export const answer = 42;\nexport type Answer = number;\n',
    );
    await writeFile(
      path.join(directory, 'src/main.ts'),
      [
        "import { answer } from './value.ts';",
        "import type { Answer } from './value.ts';",
        "export { answer } from './value.ts';",
        "export type { Answer } from './value.ts';",
        'export const result: Answer = answer;',
        "export const load = () => import('./value.ts');",
      ].join('\n'),
    );
    const config = {
      extends: fileURLToPath(new URL('../../tsconfig.json', import.meta.url)),
      compilerOptions: { outDir: './dist', rootDir: './src', types: [] },
      exclude: [],
      include: ['src/*.ts'],
    };
    const configPath = path.join(directory, 'tsconfig.json');
    await writeFile(configPath, JSON.stringify(config));
    const compile = () =>
      spawnSync(
        process.execPath,
        [fileURLToPath(import.meta.resolve('typescript/lib/tsc.js')), '-p', configPath],
        { encoding: 'utf8' },
      );
    const built = compile();
    assert.equal(built.status, 0, built.stdout + built.stderr);
    const output = await readFile(path.join(directory, 'dist/main.js'), 'utf8');
    assert.match(output, /from ['"]\.\/value\.js['"]/);
    assert.match(output, /import\(['"]\.\/value\.js['"]\)/);
    assert.doesNotMatch(output, /['"]\.\/value\.ts['"]/);
    const module = await import(pathToFileURL(path.join(directory, 'dist/main.js')).href);
    assert.equal(module.result, 42);
    assert.equal(module.answer, 42);
    assert.equal((await module.load()).answer, 42);

    await writeFile(
      path.join(directory, 'consumer.ts'),
      "import { result, type Answer } from './dist/main.js';\nexport const answer: Answer = result;\n",
    );
    await writeFile(
      configPath,
      JSON.stringify({
        ...config,
        compilerOptions: {
          noEmit: true,
          rewriteRelativeImportExtensions: false,
          rootDir: '.',
          skipLibCheck: false,
          types: [],
        },
        include: ['consumer.ts'],
      }),
    );
    const consumer = compile();
    assert.equal(consumer.status, 0, consumer.stdout + consumer.stderr);
    await writeFile(
      path.join(directory, 'consumer.ts'),
      "import type { Answer } from './dist/main.js';\nexport const wrong: Answer = 'not a number';\n",
    );
    const invalid = compile();
    assert.notEqual(invalid.status, 0, 'Declaration consumers must retain the exported type');
    assert.match(invalid.stdout + invalid.stderr, /not assignable to type 'number'/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
