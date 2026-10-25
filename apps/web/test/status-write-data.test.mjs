import assert from 'node:assert/strict';
import test from 'node:test';

import { configurationChanged } from '../src/features/config/configurationEvents.ts';
import { readStatusWriteResponse } from '../src/features/config/statuses/statusWriteData.ts';

import { statusConfigId, statusConfigurationFixture } from './common/status-config-fixture.mjs';

test('status writes accept only a new revision and matching canonical tenant/scope identity', () => {
  const fixture = statusConfigurationFixture();
  const command = {
    kind: 'update',
    statusId: fixture.rows[0].identity.id,
    body: { expectedConfigVersion: 1, name: 'Queued' },
  };
  const value = {
    data: { ...fixture.rows[0], override: { ...fixture.rows[0].override, name: 'Queued' } },
    configVersion: 2,
  };
  const expected = { owner: fixture.scopes[0], workspaceId: fixture.workspaceId, command };
  assert.equal(readStatusWriteResponse(value, expected).success, true);
  assert.equal(
    readStatusWriteResponse({ data: fixture.rows[0], configVersion: 1 }, expected).success,
    false,
  );
  assert.equal(
    readStatusWriteResponse(
      { data: fixture.rows[0], configVersion: 1 },
      { ...expected, command: { ...command, body: { expectedConfigVersion: 1, name: 'To do' } } },
    ).success,
    true,
  );
  for (const mutate of [
    (copy) => {
      copy.data.identity.id = statusConfigId(999);
    },
    (copy) => {
      copy.data.identity.workspaceId = statusConfigId(999);
    },
    (copy) => {
      copy.data.override.ownerId = statusConfigId(999);
    },
    (copy) => {
      copy.data.override.ownerType = 'list';
    },
    (copy) => {
      copy.data.override.statusId = statusConfigId(999);
    },
  ]) {
    const copy = structuredClone(value);
    mutate(copy);
    assert.equal(readStatusWriteResponse(copy, expected).success, false);
  }
});
test('configuration refresh notifications match committed or uncertain writes in the active session and workspace', () => {
  const scope = { revision: 3, userId: 'alice', workspaceId: 'engineering' };
  assert.equal(
    configurationChanged(['configuration-write', 3, 'alice', 'engineering'], 'success', scope),
    true,
  );
  assert.equal(
    configurationChanged(['configuration-write', 3, 'alice', 'engineering'], 'error', scope),
    true,
  );
  for (const [key, action] of [
    [['configuration-write', 2, 'alice', 'engineering'], 'success'],
    [['configuration-write', 3, 'bob', 'engineering'], 'success'],
    [['configuration-write', 3, 'alice', 'research'], 'success'],
  ])
    assert.equal(configurationChanged(key, action, scope), false);
});
