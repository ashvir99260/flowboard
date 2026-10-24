import { expect, test } from '@jest/globals';

import { FieldValuesSchema, ListTasksQuerySchema } from '../dist/index.js';

test('a valid escaped text value remains valid as a JSON-encoded equality filter', () => {
  const value = '"'.repeat(2000);
  expect(FieldValuesSchema.safeParse({ text: value }).success).toBe(true);
  expect(
    ListTasksQuerySchema.safeParse({
      fieldKey: 'text',
      fieldOperator: 'eq',
      fieldValue: JSON.stringify(value),
    }).success,
  ).toBe(true);
});
