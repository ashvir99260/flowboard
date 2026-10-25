import assert from 'node:assert/strict';
import test from 'node:test';

import { readStatusConfiguration } from '../src/features/config/statuses/statusConfiguration.ts';
import {
  previewStatusEdit,
  previewStatusRemoval,
  statusCommand,
  statusDefaults,
  statusDraftSchema,
} from '../src/features/config/statuses/statusFormData.ts';

import { statusConfigId, statusConfigurationFixture } from './common/status-config-fixture.mjs';

const setup = () => {
  const fixture = statusConfigurationFixture();

  return {
    fixture,
    configuration: readStatusConfiguration({ ...fixture, scope: fixture.scopes[3] }),
  };
};
test('status overrides preview inherited attributes and keep canonical identity on rename', () => {
  const { fixture, configuration } = setup();
  const target = fixture.rows[1].identity.id;
  const draft = { ...statusDefaults(configuration, target), name: 'Building' };
  const command = statusCommand(configuration, draft, target);
  assert.equal(command.kind, 'create');
  assert.equal(command.body.kind, 'override');
  assert.equal(command.body.statusId, target);
  assert.equal(command.body.color, null);
  const preview = previewStatusEdit(configuration, draft, target);
  assert.equal(preview.success, true);
  assert.equal(preview.items[1].id, target);
  assert.equal(preview.items[1].name, 'Building');
  assert.equal(preview.items[1].color, '#334455');
});
test('status previews reject last-category hiding and support hidden closed status restoration', () => {
  const { fixture, configuration } = setup();
  const active = fixture.rows[1].identity.id;
  assert.equal(
    previewStatusEdit(
      configuration,
      { ...statusDefaults(configuration, active), hidden: true },
      active,
    ).success,
    false,
  );
  const closed = fixture.rows[3].identity.id;
  const local = {
    ...fixture.rows[3],
    override: {
      ...fixture.rows[3].override,
      ...fixture.scopes[3],
      id: statusConfigId(31),
      hidden: true,
    },
  };
  fixture.collections[3].data.items.push(local);
  const hidden = readStatusConfiguration({ ...fixture, scope: fixture.scopes[3] });
  const restored = previewStatusEdit(
    hidden,
    { ...statusDefaults(hidden, closed), hidden: false },
    closed,
  );
  assert.equal(restored.success, true);
  assert.equal(restored.items.at(-1).id, closed);
  assert.equal(previewStatusRemoval(hidden, closed).items.at(-1).id, closed);
});
test('status forms share request validation and use minimal patches or no-op', () => {
  const { fixture, configuration } = setup();
  const empty = statusDefaults(configuration);
  assert.equal(statusDraftSchema(configuration).safeParse(empty).success, false);
  const draft = {
    ...empty,
    key: 'review',
    category: 'active',
    name: 'Review',
    color: '#334455',
    position: 0,
  };
  assert.equal(statusDraftSchema(configuration).safeParse(draft).success, true);
  assert.equal(
    previewStatusEdit(configuration, draft).items.some((item) => item.key === 'review'),
    true,
  );
  assert.equal(previewStatusEdit(configuration, { ...draft, key: 'active' }).success, false);
  const workspace = readStatusConfiguration({
    ...fixture,
    scope: fixture.scopes[0],
    collections: [fixture.collections[0]],
  });
  const target = fixture.rows[1].identity.id;
  const original = statusDefaults(workspace, target);
  assert.equal(statusCommand(workspace, original, target), null);
  assert.equal(statusCommand(workspace, { ...original, name: ' In progress ' }, target), null);
  assert.deepEqual(statusCommand(workspace, { ...original, name: 'Building' }, target).body, {
    expectedConfigVersion: 1,
    name: 'Building',
  });
});
