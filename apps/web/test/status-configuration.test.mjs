import assert from 'node:assert/strict';
import test from 'node:test';

import { readStatusConfiguration } from '../src/features/config/statuses/status-configuration.ts';

import { statusConfigId, statusConfigurationFixture } from './common/status-config-fixture.mjs';

test('status configuration combines verified ancestors and retains canonical identities', () => {
  const fixture = statusConfigurationFixture();
  const local = {
    identity: fixture.rows[1].identity,
    override: {
      ...fixture.rows[1].override,
      ...fixture.scopes[3],
      id: statusConfigId(30),
      name: 'Building',
      color: null,
      position: null,
      hidden: null,
    },
  };
  fixture.collections[3].data.items.push(local);
  const result = readStatusConfiguration({ ...fixture, scope: fixture.scopes[3] });
  assert.equal(result.state, 'ready');
  assert.equal(result.effective[1].name, 'Building');
  assert.equal(result.effective[1].id, fixture.rows[1].identity.id);
  assert.equal(result.effective[1].color, '#334455');
  assert.equal(result.input.identities.length, 4);
});

test('status configuration fails closed for foreign, incomplete and mixed revision chains', () => {
  const fixture = statusConfigurationFixture();
  const input = { ...fixture, scope: fixture.scopes[3] };
  assert.equal(
    readStatusConfiguration({ ...input, collections: fixture.collections.slice(1) }).state,
    'pending',
  );
  const mixed = structuredClone(input);
  mixed.collections[1].data.configVersion = 2;
  assert.equal(readStatusConfiguration(mixed).state, 'stale');
  for (const corrupt of [
    (copy) => {
      copy.collections[0].data.items[0].identity.workspaceId = statusConfigId(99);
    },
    (copy) => {
      copy.collections[3].data.ancestorScopes.reverse();
    },
    (copy) => {
      copy.collections[2].data.ancestorScopes[0].ownerId = statusConfigId(99);
    },
    (copy) => {
      copy.collections[0].data.items[0].override.ownerId = statusConfigId(99);
    },
    (copy) => {
      copy.collections[0].data.items[0].override.statusId = statusConfigId(99);
    },
  ]) {
    const copy = structuredClone(input);
    corrupt(copy);
    assert.equal(readStatusConfiguration(copy).state, 'invalid');
  }
});
