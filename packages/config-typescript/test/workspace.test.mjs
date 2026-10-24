import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../../../', import.meta.url);
const workspaces = [
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/contracts',
  'packages/database',
  'packages/logger',
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

test('root and every workspace explicitly use ESM', async () => {
  for (const directory of ['', ...workspaces]) {
    assert.equal(
      (await json(`${directory ? `${directory}/` : ''}package.json`)).type,
      'module',
      directory || 'root',
    );
  }
});

test('Node preset emits loadable ESM and rejects implicit CommonJS rewriting', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowboard-esm-'));
  try {
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(path.join(directory, 'value.ts'), 'export const answer = 42;\n');
    await writeFile(
      path.join(directory, 'main.ts'),
      "import { answer } from './value.js';\nexport const result = answer;\n",
    );
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: fileURLToPath(new URL('packages/config-typescript/node.json', root)),
        compilerOptions: { outDir: './dist', rootDir: '.', types: [] },
        include: ['*.ts'],
      }),
    );
    const compile = () =>
      spawnSync(
        process.execPath,
        [
          fileURLToPath(import.meta.resolve('typescript/lib/tsc.js')),
          '-p',
          path.join(directory, 'tsconfig.json'),
        ],
        { encoding: 'utf8' },
      );
    const esm = compile();
    assert.equal(esm.status, 0, esm.stdout + esm.stderr);
    assert.equal(
      (await import(pathToFileURL(path.join(directory, 'dist/main.js')).href)).result,
      42,
    );
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ type: 'commonjs' }));
    const commonjs = compile();
    assert.notEqual(commonjs.status, 0, 'Compiler must reject rewriting authored ESM as CommonJS');
    assert.match(commonjs.stdout + commonjs.stderr, /verbatimModuleSyntax/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('ast-grep finds code calls without matching comments or string literals', () => {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'ast-grep',
      'run',
      '--lang',
      'ts',
      '--pattern',
      'console.log($$$ARGS)',
      '--stdin',
      '--json=compact',
    ],
    {
      cwd: fileURLToPath(root),
      input:
        '// console.log("comment")\nconst text = \'console.log("text")\';\nconsole.log("actual call");\n',
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const matches = JSON.parse(result.stdout);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].text, 'console.log("actual call")');
});

test('AI reports, REA installation and Serena state stay local without hiding tool guidance', () => {
  const localData = [
    '.ai-local/gitleaks.json',
    '.serena/project.yml',
    'apps/web/.ai-local/search.json',
    '.ai-local/rea/node_modules/rea-agents/package.json',
    '.ai-local/rea/npm-cache/content',
    '.ai-local/rea/tmp/analysis/checkpoint.json',
    '.ai-local/rea/swift-module-cache/module',
    '.ai-local/rea/release-tools-evidence.json',
    '.ai-local/rea/release-tools-summary.json',
  ];
  const ignored = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: fileURLToPath(root),
    input: `${localData.join('\n')}\n`,
    encoding: 'utf8',
  });
  assert.equal(ignored.status, 0);
  assert.deepEqual(ignored.stdout.trim().split('\n'), localData);
  const config = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: fileURLToPath(root),
    input: '.gitleaks.toml\ndocs/AI_TOOLS.md\ndocs/REA.md\n',
    encoding: 'utf8',
  });
  assert.equal(config.status, 1);
});

test('Graphify generated data stays untracked while its configuration remains trackable', () => {
  const outputs = [
    'graphify-out/graph.json',
    'graphify-out/graph.html',
    'graphify-out/GRAPH_REPORT.md',
    'graphify-out/cache/entry.json',
    'graphify-out/memory/query.md',
    'apps/web/graphify-out/graph.json',
    '.graphify_ast.json',
    '.graphify_python',
    'packages/ui/.graphify_detect.json',
  ];
  const ignored = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: fileURLToPath(root),
    input: `${outputs.join('\n')}\n`,
    encoding: 'utf8',
  });
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.deepEqual(ignored.stdout.trim().split('\n'), outputs);
  const config = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: fileURLToPath(root),
    input: '.graphifyignore\ndocs/GRAPHIFY.md\n',
    encoding: 'utf8',
  });
  assert.equal(config.status, 1, config.stderr);
  assert.equal(config.stdout, '');
});

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

test('strict Turbo development preserves worker dependencies and frozen image runtime settings', async () => {
  for (const task of ['dev', 'dev:docker']) {
    const result = spawnSync(
      'pnpm',
      ['exec', 'turbo', 'run', task, '--filter=@flowboard/worker', '--dry=json'],
      {
        cwd: fileURLToPath(root),
        encoding: 'utf8',
        env: { ...process.env, PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false' },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    const worker = plan.tasks.find((entry) => entry.taskId === `@flowboard/worker#${task}`);
    for (const variable of ['DATABASE_URL', 'REDIS_URL', 'HOST', 'PORT', 'LOG_LEVEL'])
      assert.ok(
        worker.environmentVariables.specified.env.includes(variable),
        `${task} drops ${variable}`,
      );
    assert.ok(
      plan.globalCacheInputs.environmentVariables.specified.passThroughEnv.includes(
        'PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN',
      ),
    );
  }
  for (const app of ['api', 'web', 'worker']) {
    const dockerfile = await readFile(new URL(`apps/${app}/Dockerfile`, root), 'utf8');
    const development = dockerfile.split(' AS development')[1].split(/^FROM /m)[0];
    assert.match(development, /PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false/);
  }
});
