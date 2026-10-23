import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@hey-api/openapi-ts';

import config from '../openapi-ts.config.mjs';

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    result.push(...(entry.isDirectory() ? await files(directory, path) : [path]));
  }

  return result.sort();
}

if (process.argv.includes('--write')) {
  await createClient(config);
} else {
  const target =
    process.argv.find((value) => value.startsWith('--target='))?.slice('--target='.length) ??
    'src/generated';
  const temporary = await mkdtemp(join(tmpdir(), 'flowboard-client-'));
  try {
    await createClient({ ...config, output: { ...config.output, path: temporary } });
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
