import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));

test('dynamic services and the only worker share the existing datastores Ohio region', () => {
  assert.deepEqual(config.regions, ['cle1']);
  assert.deepEqual(config.daemons.worker.instances, { cle1: 1 });
  assert.deepEqual(config.daemons.worker.resources.requests, { memory: '1Gi' });

  for (const service of Object.values(config.services)) {
    assert.equal(service.regions, undefined, 'regions is not a direct service property');

    for (const settings of Object.values(service.functions ?? {})) {
      if (settings.regions) assert.deepEqual(settings.regions, ['cle1']);
    }
  }
  assert.equal(config.git.deploymentEnabled, false);
});
