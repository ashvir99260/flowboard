import { expect, test } from '@jest/globals';

import * as contracts from '../dist/index.js';

const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const source = { id: id(1), key: 'working', category: 'active', position: 0 };
const target = [
  { id: id(3), key: 'z', category: 'active', position: 1 },
  { id: id(2), key: 'a', category: 'active', position: 1 },
];

test('status selection preserves identities, sorts same-category fallbacks and fails closed', () => {
  expect(contracts.selectTaskStatus(source, target)).toEqual({ success: true, statusId: id(2) });
  expect(contracts.selectTaskStatus(source, [...target, source])).toEqual({
    success: true,
    statusId: id(1),
  });
  expect(contracts.selectTaskStatus(source, target, id(3))).toEqual({
    success: true,
    statusId: id(3),
  });
  expect(contracts.selectTaskStatus(source, target, id(99)).success).toBe(false);
  expect(contracts.selectTaskStatus({ ...source, category: 'closed' }, target).success).toBe(false);
});

test('fallback ties use the same code-point key order as resolved statuses', () => {
  const values = [
    { ...target[0], key: 'a_' },
    { ...target[1], key: 'a0' },
  ];
  expect(contracts.selectTaskStatus(source, values)).toEqual({
    success: true,
    statusId: target[1].id,
  });
});
