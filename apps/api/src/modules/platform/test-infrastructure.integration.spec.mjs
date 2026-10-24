import { execFileSync, spawnSync } from 'node:child_process';

import { expect, test } from '@jest/globals';

import { startInfrastructure } from '../../../test/common/infrastructure.mjs';

test('closing isolated API infrastructure removes its owned anonymous volumes', async () => {
  const infrastructure = await startInfrastructure();
  const volumes = [];
  try {
    const containers = JSON.parse(
      execFileSync('docker', ['inspect', ...infrastructure.names], { encoding: 'utf8' }),
    );
    volumes.push(
      ...containers.flatMap((container) =>
        container.Mounts.filter((mount) => mount.Type === 'volume').map((mount) => mount.Name),
      ),
    );
    expect(volumes.length).toBeGreaterThan(0);
    infrastructure.close();
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
    // Restrict fallback cleanup to IDs captured from this test's own containers.
    for (const name of infrastructure.names)
      spawnSync('docker', ['rm', '--force', '--volumes', name]);
    for (const volume of volumes) spawnSync('docker', ['volume', 'rm', volume]);
  }
});
