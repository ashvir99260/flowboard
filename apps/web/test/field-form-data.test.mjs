import assert from 'node:assert/strict';
import test from 'node:test';

import { readFieldConfiguration } from '../src/features/config/fields/fieldConfiguration.ts';
import {
  fieldCommand,
  fieldDefaults,
  previewFieldEdit,
  previewFieldRemoval,
} from '../src/features/config/fields/fieldFormData.ts';

import { fieldConfigurationFixture } from './common/field-config-fixture.mjs';

function configuration(local = false) {
  const fixture = fieldConfigurationFixture();
  const scope = fixture.scopes[local ? 2 : 3];

  return readFieldConfiguration({
    ...fixture,
    scope,
    collections: fixture.collections.slice(0, local ? 3 : 4),
  });
}

test('field commands copy inherited definitions completely and keep option identities', () => {
  const config = configuration();
  const draft = fieldDefaults(config, 'area');
  const originalIds = draft.options.map(({ id }) => id);
  draft.name = ' Team area ';
  draft.options.reverse();
  draft.options[0].label = 'Backend';
  const command = fieldCommand(config, draft, 'area');
  assert.equal(command.kind, 'create');
  assert.equal(command.body.name, 'Team area');
  assert.deepEqual(
    command.body.options.map(({ id }) => id),
    originalIds.toReversed(),
  );
  const preview = previewFieldEdit(config, draft, 'area');
  assert.equal(preview.success, true);
  assert.equal(preview.items.find(({ key }) => key === 'area').isInherited, false);
  assert.equal(config.effective.find(({ key }) => key === 'area').name, 'area');
});

test('field updates normalize no-ops, send changed attributes and remove local definitions in previews', () => {
  const config = configuration(true);
  const draft = fieldDefaults(config, 'area');
  assert.equal(fieldCommand(config, { ...draft, name: ' area ' }, 'area'), null);
  const changed = fieldCommand(config, { ...draft, required: true }, 'area');
  assert.deepEqual(changed.body, { expectedConfigVersion: 1, required: true });
  assert.equal(changed.fieldId, config.local[0].id);
  assert.equal(
    previewFieldRemoval(config, 'area').items.some(({ key }) => key === 'area'),
    false,
  );
  assert.throws(() => fieldCommand(config, { ...draft, key: 'other' }, 'area'));
});

test('field forms validate all six types, options, required values and immutable keys through shared contracts', () => {
  const config = configuration();
  for (const type of ['text', 'number', 'single_select', 'multi_select', 'date', 'checkbox']) {
    const draft = { ...fieldDefaults(config), key: `test_${type}`, name: 'Example', type };
    assert.equal(previewFieldEdit(config, draft).success, true);
  }
  const draft = fieldDefaults(config, 'area');
  for (const invalid of [
    { ...draft, name: '' },
    { ...draft, required: null },
    { ...draft, type: 'number' },
    { ...draft, position: -1 },
    { ...draft, options: [draft.options[0], draft.options[0]] },
    { ...draft, options: [{ ...draft.options[0], color: 'red' }] },
  ])
    assert.equal(previewFieldEdit(config, invalid, 'area').success, false);
  assert.equal(
    previewFieldEdit(
      config,
      { ...draft, options: draft.options.map((option) => ({ ...option, label: 'Same' })) },
      'area',
    ).success,
    true,
  );
});

test('new fields cannot duplicate a local key', () => {
  const config = configuration(true);
  assert.equal(previewFieldEdit(config, fieldDefaults(config, 'area')).success, false);
});

test('blank option colors become omitted values and uncolored edits remain no-ops', () => {
  const config = configuration(true);
  const draft = fieldDefaults(config, 'area');
  draft.options[0].color = '';
  const command = fieldCommand(config, draft, 'area');
  assert.equal(Object.hasOwn(command.body.options[0], 'color'), false);
  const uncolored = structuredClone(config);
  for (const collection of [uncolored.local, uncolored.effective]) {
    delete collection.find(({ key }) => key === 'area').options[0].color;
  }
  const unchanged = fieldDefaults(uncolored, 'area');
  assert.equal(fieldCommand(uncolored, unchanged, 'area'), null);
});
