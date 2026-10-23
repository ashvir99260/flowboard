import { cp } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('.next/standalone/apps/web/', root);

// Next traces server dependencies; browser assets need to accompany that output.
await cp(new URL('.next/static/', root), new URL('.next/static/', output), { recursive: true });
try {
  await cp(new URL('public/', root), new URL('public/', output), { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
