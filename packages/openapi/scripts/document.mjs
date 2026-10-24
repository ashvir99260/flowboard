import { writeFile } from 'node:fs/promises';

import { exportOpenApi } from '@flowboard/api/spec';

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, ordered(item)]),
    );
  }

  return value;
}

export async function writeDocument(target) {
  const output = JSON.stringify(ordered(await exportOpenApi()), null, 2) + '\n';
  await writeFile(target, output);
}
