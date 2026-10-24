import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@hey-api/openapi-ts';

import configuration from '../openapi-ts.config.mjs';

const config = {
  ...configuration,
  configFile: fileURLToPath(new URL('../openapi-ts.config.mjs', import.meta.url)),
};

async function generate(options) {
  const contexts = await createClient(options);
  if (!Array.isArray(contexts) || contexts.length !== 1)
    throw new Error('API client generation did not complete. Check the OpenAPI input.');
}

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    result.push(...(entry.isDirectory() ? await files(directory, path) : [path]));
  }

  return result.sort();
}

if (process.argv.includes('--write')) {
  await generate(config);
} else {
  const target =
    process.argv.find((value) => value.startsWith('--target='))?.slice('--target='.length) ??
    fileURLToPath(new URL('../src/generated', import.meta.url));
  const temporary = await mkdtemp(join(tmpdir(), 'flowboard-client-'));
  try {
    await generate({ ...config, output: { ...config.output, path: temporary } });
    const expected = await files(temporary);
    const committed = await files(target);
    if (JSON.stringify(expected) !== JSON.stringify(committed))
      throw new Error('Generated API client files drifted. Run pnpm gen:api.');

    for (const path of expected) {
      const [actual, existing] = await Promise.all([
        readFile(join(temporary, path)),
        readFile(join(target, path)),
      ]);
      if (!actual.equals(existing))
        throw new Error(`Generated API client drifted: ${path}. Run pnpm gen:api.`);
    }
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}
