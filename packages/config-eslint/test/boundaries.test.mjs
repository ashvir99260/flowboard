import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

import boundaries from '../src/boundaries.mjs';

const root = await mkdtemp(path.join(tmpdir(), 'flowboard-boundaries-'));
const names = [
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/contracts',
  'packages/database',
  'packages/logger',
  'packages/ui',
  'packages/forms',
  'packages/openapi',
  'packages/api-client',
];
for (const name of names) {
  await mkdir(path.join(root, name, 'src'), { recursive: true });
  await writeFile(
    path.join(root, name, 'package.json'),
    JSON.stringify({ name: `@flowboard/${path.basename(name)}` }),
  );
}
await writeFile(
  path.join(root, 'apps/web/tsconfig.json'),
  JSON.stringify({ compilerOptions: { paths: { '@api/*': ['../api/src/*'] } } }),
);
await writeFile(
  path.join(root, 'apps/api/tsconfig.json'),
  JSON.stringify({ compilerOptions: { paths: { '@features/*': ['./src/modules/*'] } } }),
);
after(() => rm(root, { force: true, recursive: true }));

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tseslint.parser },
      plugins: { flowboard: { rules: { boundaries } } },
      rules: { 'flowboard/boundaries': ['error', { root }] },
    },
  ],
});

async function check(file, code) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  assert.ok(result);
  assert.ok(
    !result.messages.some((m) => m.fatal),
    'syntax errors must not count as boundary detection',
  );

  return result.messages.filter((m) => m.ruleId === 'flowboard/boundaries');
}

for (const [file, code] of [
  ['apps/api/src/example.ts', "import { createLogger } from '@flowboard/logger';"],
  ['apps/worker/src/example.ts', "import { createLogger } from '@flowboard/logger';"],
  ['packages/database/src/example.ts', "import { createLogger } from '@flowboard/logger';"],
  ['apps/api/src/example.ts', "import { schema } from '@flowboard/contracts';"],
  [
    'packages/api-client/src/session-state.ts',
    "import { SessionEnvelopeSchema } from '@flowboard/contracts';",
  ],
  ['packages/contracts/src/example.ts', "import { z } from 'zod';"],
  ['packages/contracts/src/example.ts', "export { value } from './local.js';"],
  ['packages/database/src/example.ts', "import { PrismaClient } from '@prisma/client';"],
  ['packages/openapi/scripts/export.ts', "import { buildSpec } from '@flowboard/api/spec';"],
  ['apps/api/src/core/common/example.ts', "import '../config/application.config.js';"],
  ['apps/api/src/core/common/example.ts', "import { schema } from '@flowboard/contracts';"],
  ['apps/api/src/shared/example.ts', "import '../core/common/tokens/logger.token.js';"],
  ['apps/api/src/modules/auth/example.ts', "import '../../shared/logging/logging.module.js';"],
]) {
  test(`allows ${file}: ${code}`, async () => assert.equal((await check(file, code)).length, 0));
}

for (const [file, code] of [
  ['packages/logger/src/example.ts', "import { schema } from '@flowboard/contracts';"],
  ['packages/api-client/src/setup-client.ts', "import { database } from '@flowboard/database';"],
  ['apps/web/src/example.ts', "import { createLogger } from '@flowboard/logger';"],
  ['packages/ui/src/example.ts', "import { createLogger } from '@flowboard/logger';"],
  ['apps/web/src/example.ts', "import type { Internal } from '@flowboard/api';"],
  ['apps/api/src/example.ts', "export * from '@flowboard/web';"],
  ['apps/worker/src/example.ts', "await import('@flowboard/api');"],
  ['apps/web/src/example.ts', "const api = require('@flowboard/api');"],
  ['apps/web/src/example.ts', "type Internal = import('@flowboard/api').Internal;"],
  ['apps/web/src/example.ts', "import api = require('@flowboard/api');"],
  ['apps/web/src/example.ts', "import { api } from '../../api/src/index.js';"],
  ['apps/web/src/example.ts', "import { api } from '@api/index';"],
  ['apps/web/src/example.ts', "import { value } from '../../../packages/contracts/src/index.js';"],
  ['packages/ui/src/example.ts', "import { client } from '@flowboard/api-client';"],
  ['packages/contracts/src/example.ts', "import { Injectable } from '@nestjs/common';"],
  ['packages/contracts/src/example.ts', "import path from 'node:path';"],
  ['apps/api/src/example.ts', "import { PrismaClient } from '@prisma/client';"],
  ['packages/openapi/src/example.ts', "import { buildSpec } from '@flowboard/api/spec';"],
  ['packages/openapi/scripts/export.ts', "import { Internal } from '@flowboard/api/internal';"],
  ['packages/ui/src/example.ts', "fetch('/v1/tasks');"],
  ['apps/web/src/example.ts', "fetch('/v1/tasks');"],
  ['apps/web/src/example.ts', "import axios from 'axios';"],
  ['packages/ui/src/example.ts', "import { useQuery } from '@tanstack/react-query';"],
  ['apps/web/src/example.ts', "await import('@flowboard/' + name);"],
  ['apps/web/src/example.ts', `import '${path.join(root, 'apps/api/dist/index.js')}';`],
  [
    'apps/web/src/example.ts',
    `import '${pathToFileURL(path.join(root, 'apps/api/dist/index.js')).href}';`,
  ],
  ['apps/api/src/example.ts', "const other = require('@flowboard/' + name);"],
  ['apps/api/src/example.ts', "import '../node_modules/@prisma/client/index.js';"],
  ['apps/web/src/example.ts', "globalThis['fetch']('/v1/tasks');"],
  ['apps/api/src/core/common/example.ts', "import '../../shared/logging/logging.module.js';"],
  ['apps/api/src/core/example.ts', "import type { Auth } from '../modules/auth/auth.service.js';"],
  ['apps/api/src/core/example.ts', "await import('../modules/auth/auth.service.js');"],
  ['apps/api/src/shared/example.ts', "export * from '../modules/auth/auth.service.js';"],
  [
    'apps/api/src/core/example.ts',
    `import '${pathToFileURL(path.join(root, 'apps/api/src/shared/shared.module.js')).href}';`,
  ],
  ['apps/api/src/core/example.ts', "import '@features/auth/auth.service.js';"],
]) {
  test(`rejects ${file}: ${code}`, async () => assert.equal((await check(file, code)).length, 1));
}

test('rejects an inherited alias from a valid JSONC config', async () => {
  await mkdir(path.join(root, 'configs'), { recursive: true });
  await writeFile(
    path.join(root, 'configs/base.json'),
    '{ // shared aliases\n "compilerOptions": { "baseUrl": "..", "paths": { "@backend/*": ["apps/api/src/*"], }, }, }',
  );
  await writeFile(
    path.join(root, 'apps/worker/tsconfig.json'),
    '{"extends":"../../configs/base.json"}',
  );
  assert.equal((await check('apps/worker/src/example.ts', "import '@backend/index';")).length, 1);
});

test('only the server-only API proxy may perform direct web fetches', async () => {
  assert.equal(
    (
      await check(
        'apps/web/src/server/api-proxy.ts',
        "import 'server-only'; fetch('https://fixed.example/v1/tasks');",
      )
    ).length,
    0,
  );
  assert.equal(
    (await check('apps/web/src/server/api-proxy.ts', "fetch('https://fixed.example/v1/tasks');"))
      .length,
    1,
  );
  assert.equal(
    (
      await check(
        'apps/web/src/server/other-proxy.ts',
        "import 'server-only'; fetch('https://fixed.example/v1/tasks');",
      )
    ).length,
    1,
  );
});

for (const code of [
  "import Button from '@mui/material/Button';",
  "export { Button } from '@mui/material';",
  "export * from '@mui/material/styles';",
  "await import('@mui/material/Dialog');",
  "import type { Theme } from '@mui/material/styles';",
]) {
  for (const directory of ['src', 'app']) {
    test(`web ${directory} uses shared presentation: ${code}`, async () => {
      assert.equal((await check(`apps/web/${directory}/example.ts`, code)).length, 1);
    });
  }
}
for (const [file, code] of [
  ['apps/web/src/example.ts', "import { Button } from '@flowboard/ui';"],
  ['packages/ui/src/example.ts', "import Button from '@mui/material/Button';"],
  [
    'packages/ui/src/example.ts',
    "import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';",
  ],
  ['apps/web/test/fixtures/src/example.ts', "import Button from '@mui/material/Button';"],
]) {
  test(`shared presentation allowance ${file}`, async () =>
    assert.equal((await check(file, code)).length, 0));
}
for (const code of [
  "import { useRouter } from 'next/navigation';",
  "import { useRouter } from 'next/router';",
  "import { useForm } from 'react-hook-form';",
]) {
  test(`shared UI rejects web coordination: ${code}`, async () =>
    assert.equal((await check('packages/ui/src/example.ts', code)).length, 1));
}

for (const entry of [
  'next/compat/router',
  'next/compat/router.js',
  'next/navigation.js',
  'next/router.js',
]) {
  test(`shared UI rejects alternate router entry ${entry}`, async () =>
    assert.equal(
      (await check('packages/ui/src/example.ts', `import { useRouter } from '${entry}';`)).length,
      1,
    ));
}

for (const code of [
  "import { useRouter } from 'next/navigation';",
  "import { useQuery } from '@tanstack/react-query';",
  "fetch('/v1/tasks');",
  "import { client } from '@flowboard/api-client';",
]) {
  test(`forms reject app/data coordination: ${code}`, async () =>
    assert.equal((await check('packages/forms/src/example.ts', code)).length, 1));
}
for (const [file, code] of [
  ['apps/web/src/example.ts', "import { FormFields } from '@flowboard/forms';"],
  ['packages/forms/src/example.ts', "import { FormField } from '@flowboard/ui';"],
  ['packages/forms/src/example.ts', "import { useController } from 'react-hook-form';"],
]) {
  test(`forms boundary allows ${code}`, async () =>
    assert.equal((await check(file, code)).length, 0));
}
test('UI cannot depend on forms', async () =>
  assert.equal(
    (await check('packages/ui/src/example.ts', "import { FormFields } from '@flowboard/forms';"))
      .length,
    1,
  ));

test('forms use UI instead of direct Material controls', async () =>
  assert.equal(
    (await check('packages/forms/src/example.ts', "import Button from '@mui/material/Button';"))
      .length,
    1,
  ));
