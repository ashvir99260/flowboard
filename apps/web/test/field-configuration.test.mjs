import assert from 'node:assert/strict';
import test from 'node:test';

import { readFieldConfiguration } from '../src/features/config/fields/fieldConfiguration.ts';

import { fieldConfigurationFixture } from './common/field-config-fixture.mjs';

const input = () => {
  const fixture = fieldConfigurationFixture();

  return { ...fixture, scope: fixture.scopes.at(-1) };
};
test('field configuration verifies ancestor scopes and resolves nearest complete definitions', () => {
  const fixture = input();
  const ready = readFieldConfiguration(fixture);
  assert.equal(ready.state, 'ready');
  assert.equal(ready.effective.length, 2);
  assert.equal(ready.effective.find(({ key }) => key === 'area').isInherited, true);
  const replacement = {
    ...fixture.base,
    ...fixture.scope,
    id: '70000000-0000-4000-8000-000000000099',
    type: 'text',
    name: 'Local effort',
  };
  fixture.collections.at(-1).data.items.push(replacement);
  const overridden = readFieldConfiguration(fixture);
  assert.equal(overridden.state, 'ready');
  assert.equal(overridden.effective.find(({ key }) => key === 'effort').type, 'text');
  assert.equal(overridden.effective.find(({ key }) => key === 'effort').isInherited, false);
  assert.equal(overridden.local.length, 1);
});

test('field configuration fails closed on foreign, missing, duplicate and mixed-revision data', () => {
  const fixture = input();
  const mutate = (fn) => {
    const copy = structuredClone(fixture);
    fn(copy);

    return readFieldConfiguration(copy).state;
  };
  assert.equal(
    mutate((copy) => {
      copy.collections[0].data.items[0].workspaceId = copy.scopes[1].ownerId;
    }),
    'invalid',
  );
  assert.equal(
    mutate((copy) => {
      copy.collections[2].data.ancestorScopes.reverse();
    }),
    'invalid',
  );
  assert.equal(
    mutate((copy) => {
      copy.collections[0].data.configVersion = 2;
    }),
    'stale',
  );
  assert.equal(
    mutate((copy) => {
      copy.collections[0].data = undefined;
    }),
    'pending',
  );
  assert.equal(
    mutate((copy) => {
      copy.collections[0].data.items.push(copy.base);
    }),
    'invalid',
  );
});
