import assert from 'node:assert/strict';
import test from 'node:test';

import { readListFilter } from '../src/features/list/listFilter.ts';

import { field, ids } from './common/board-fixture.mjs';

const fields = [
  field('effort', 'number'),
  field('approved', 'checkbox'),
  field('area', 'single_select'),
];
const query = (key, value, operator = 'eq') => ({
  sort: 'dueDate',
  direction: 'asc',
  fieldKey: key,
  fieldOperator: operator,
  fieldValue: JSON.stringify(value),
});

test('filters validate with the resolved field type without losing zero or false', () => {
  assert.deepEqual(readListFilter(query('effort', 0), fields), { ok: true, value: 0 });
  assert.deepEqual(readListFilter(query('approved', false), fields), { ok: true, value: false });
  assert.deepEqual(readListFilter(query('area', ids.option), fields), {
    ok: true,
    value: ids.option,
  });
  assert.deepEqual(readListFilter({ direction: 'asc', sort: 'dueDate' }, fields), { ok: true });
});

test('multi-select filters contain one option and reject arrays or mismatched operators', () => {
  const tags = { ...field('tags', 'multi_select'), options: fields[2].options };
  assert.deepEqual(readListFilter(query('tags', ids.option, 'contains'), [tags]), {
    ok: true,
    value: ids.option,
  });
  for (const input of [
    query('tags', [ids.option], 'contains'),
    query('tags', ids.option),
    query('area', ids.option, 'contains'),
    query('tags', '30000000-0000-4000-8000-000000009999', 'contains'),
  ])
    assert.equal(readListFilter(input, [...fields, tags]).ok, false);
});

test('wrong types, missing definitions, invalid options and malformed scalar JSON are rejected', () => {
  for (const input of [
    query('effort', '0'),
    query('approved', 'false'),
    query('effort', null),
    query('effort', {}),
    query('unknown', 1),
    query('area', '30000000-0000-4000-8000-000000009999'),
    { ...query('effort', 1), fieldValue: '{broken' },
    { ...query('effort', 1), fieldValue: '1e999' },
    { direction: 'asc', fieldKey: 'effort', sort: 'dueDate' },
  ])
    assert.equal(readListFilter(input, fields).ok, false);
});
