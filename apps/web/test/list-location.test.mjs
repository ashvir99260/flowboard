import assert from 'node:assert/strict';
import test from 'node:test';

import { readListLocation, writeListLocation } from '../src/features/list/list-location.ts';

test('list URLs use the shared task query contract and retain raw filter values', () => {
  assert.deepEqual(readListLocation('view=list&sort=priority&direction=desc'), {
    ok: true,
    view: 'list',
    query: { direction: 'desc', sort: 'priority' },
  });
  assert.deepEqual(readListLocation('view=list'), {
    ok: true,
    view: 'list',
    query: { direction: 'asc', sort: 'dueDate' },
  });
  const filtered = readListLocation('view=list&fieldKey=effort&fieldOperator=eq&fieldValue=0.0');
  assert.equal(filtered.ok, true);
  assert.equal(filtered.query.fieldValue, '0.0');
});

test('URL changes omit cursors, preserve scalar encoding and reset table options for board view', () => {
  const query = {
    direction: 'asc',
    fieldKey: 'label',
    fieldOperator: 'eq',
    fieldValue: '"R&D / <test>"',
    sort: 'dueDate',
  };
  const encoded = writeListLocation(query);
  assert.deepEqual(readListLocation(encoded), { ok: true, view: 'list', query });
  assert.equal(new URLSearchParams(encoded).has('cursor'), false);
  assert.equal(writeListLocation(query, 'board'), '');
  assert.deepEqual(readListLocation(''), {
    ok: true,
    view: 'board',
    query: { direction: 'asc', sort: 'dueDate' },
  });
});

test('unknown, repeated and malformed URL options never become API queries', () => {
  for (const search of [
    'view=list&q=',
    'view=list&q=one&q=two',
    'view=calendar',
    'view=list&offset=20',
    'view=list&cursor=untrusted',
    'view=list&sort=priority&sort=dueDate',
    'view=list&sort=manual&direction=desc',
    'view=list&fieldKey=effort',
    'view=list&fieldKey=effort&fieldOperator=eq',
    'view=list&direction=',
    'sort=priority',
    'view=list&statusId=foreign',
  ])
    assert.equal(readListLocation(search).ok, false, search);
});

test('search URLs preserve query text independently of sorting and field filters', () => {
  const query = {
    q: '"Release notes" -draft',
    sort: 'priority',
    direction: 'desc',
    fieldKey: 'effort',
    fieldOperator: 'eq',
    fieldValue: '0',
  };
  expectSearch(query);
  function expectSearch(value) {
    assert.deepEqual(readListLocation(writeListLocation(value)), {
      ok: true,
      view: 'list',
      query: value,
    });
  }
  assert.equal(readListLocation('q=release').ok, false);
  assert.equal(readListLocation('view=list&q=%20release%20').query.q, 'release');
});
