import assert from 'node:assert/strict';
import test from 'node:test';

import { readFieldConfiguration } from '../src/features/config/fields/field-configuration.ts';
import { fieldCommand, fieldDefaults } from '../src/features/config/fields/field-form-data.ts';
import { readFieldWriteResponse } from '../src/features/config/fields/field-write-data.ts';

import { fieldConfigurationFixture } from './common/field-config-fixture.mjs';

test('field writes require matching scope, identity, values and committed revision', () => {
  const fixture = fieldConfigurationFixture();
  const owner = fixture.scopes[2];
  const config = readFieldConfiguration({
    ...fixture,
    scope: owner,
    collections: fixture.collections.slice(0, 3),
  });
  const command = fieldCommand(
    config,
    { ...fieldDefaults(config, 'area'), name: 'Updated' },
    'area',
  );
  const response = { data: { ...fixture.local, name: 'Updated' }, configVersion: 2 };
  const expected = { command, owner, workspaceId: fixture.workspaceId };
  assert.equal(readFieldWriteResponse(response, expected).success, true);
  assert.equal(readFieldWriteResponse({ ...response, configVersion: 1 }, expected).success, true);
  for (const invalid of [
    { ...response, configVersion: 0 },
    { ...response, data: { ...response.data, workspaceId: fixture.scopes[1].ownerId } },
    { ...response, data: { ...response.data, ownerId: fixture.scopes[1].ownerId } },
    { ...response, data: { ...response.data, id: fixture.base.id } },
    { ...response, data: { ...response.data, name: 'Unmatched' } },
  ])
    assert.equal(readFieldWriteResponse(invalid, expected).success, false);
  const create = { ...command, kind: 'create', body: fieldDefaults(config, 'area') };
  assert.equal(
    readFieldWriteResponse(
      { data: fixture.local, configVersion: 1 },
      { ...expected, command: create },
    ).success,
    false,
  );
});
