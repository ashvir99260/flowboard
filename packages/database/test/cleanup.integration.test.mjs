import { execFileSync, spawnSync } from 'node:child_process';

import { expect, test } from '@jest/globals';

import { startPostgres } from './postgres.mjs';

test('stopping an isolated PostgreSQL fixture removes its anonymous volumes', async () => {
  const postgres = await startPostgres();
  const volumes = [];
  try {
    const [container] = JSON.parse(
      execFileSync('docker', ['inspect', postgres.name], { encoding: 'utf8' }),
    );
    volumes.push(
      ...container.Mounts.filter((mount) => mount.Type === 'volume').map((mount) => mount.Name),
    );
    expect(volumes.length).toBeGreaterThan(0);
    await postgres.client.end();
    postgres.stop();
    const remaining = new Set(
      execFileSync('docker', ['volume', 'ls', '--format', '{{.Name}}'], {
        encoding: 'utf8',
        timeout: 10_000,
      })
        .trim()
        .split('\n'),
    );
    for (const volume of volumes) expect(remaining.has(volume)).toBe(false);
  } finally {
    await postgres.client.end();
    // Every ID came from this fixture's own mounts, never a user's volume inventory.
    spawnSync('docker', ['rm', '--force', '--volumes', postgres.name]);
    for (const volume of volumes) spawnSync('docker', ['volume', 'rm', volume]);
  }
});
