import { cp, mkdir } from 'node:fs/promises';

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const file of ['base', 'node', 'nest', 'next', 'library']) {
  await cp(
    new URL(`../${file}.json`, import.meta.url),
    new URL(`../dist/${file}.json`, import.meta.url),
  );
}
