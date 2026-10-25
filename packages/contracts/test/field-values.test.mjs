import { TextEncoder } from 'node:util';

import { expect, test } from '@jest/globals';
import { z } from 'zod';

import * as contracts from '../dist/index.js';

const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const time = '2026-10-24T00:00:00.000Z';
const scopes = ['workspace', 'space', 'folder', 'list'].map((ownerType, index) => ({
  ownerType,
  ownerId: id(index + 1),
}));
const option = (n) => ({ id: id(n), label: 'Choice', color: '#334455' });
const field = (n, key, type = 'text', level = 0, extra = {}) => ({
  id: id(n),
  workspaceId: id(1),
  key,
  name: key,
  type,
  required: false,
  options: [],
  position: n,
  ...scopes[level],
  createdAt: time,
  updatedAt: time,
  ...extra,
});

test('nearest owner replaces the complete definition and keeps deterministic source metadata', () => {
  const definitions = [
    field(100, 'effort', 'text', 0, { required: true }),
    field(101, 'effort', 'number', 2),
    field(102, 'team', 'single_select', 1, { options: [option(500)] }),
    field(103, 'other', 'text', 3, { ownerId: id(99) }),
  ];
  const result = contracts.resolveFields({ scopes, definitions });
  expect(result.success).toBe(true);
  expect(result.items.map((item) => item.key)).toEqual(['effort', 'team']);
  expect(result.items[0]).toMatchObject({
    id: id(101),
    type: 'number',
    required: false,
    options: [],
    isInherited: true,
    source: { fieldId: id(101), ...scopes[2], createdAt: time, updatedAt: time },
  });
  expect(contracts.resolveFields({ scopes, definitions: [...definitions].reverse() })).toEqual(
    result,
  );
});

const definitions = [
  field(200, 'note', 'text', 0, { required: true }),
  field(201, 'effort', 'number', 0, { required: true }),
  field(202, 'team', 'single_select', 0, { required: true, options: [option(500)] }),
  field(203, 'tags', 'multi_select', 0, { required: true, options: [option(501), option(502)] }),
  field(204, 'start_date', 'date', 0, { required: true }),
  field(205, 'confirmed', 'checkbox', 0, { required: true }),
];
const valid = {
  note: 'Learn',
  effort: 0,
  team: id(500),
  tags: [id(501)],
  start_date: '2024-02-29',
  confirmed: false,
};
const resolved = (rows = definitions) => {
  const result = contracts.resolveFields({ scopes, definitions: rows });
  expect(result.success).toBe(true);

  return result.items;
};

test('all six field types validate with required zero and false and without coercion', () => {
  expect(contracts.validateTaskFields({ values: valid, fields: resolved() })).toEqual([]);
  for (const [key, value] of Object.entries({
    note: 12,
    effort: '2',
    team: 'Choice',
    tags: [id(999)],
    start_date: '2023-02-29',
    confirmed: 'false',
  })) {
    const issues = contracts.validateTaskFields({
      values: { ...valid, [key]: value },
      fields: resolved(),
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].path.slice(0, 2)).toEqual(['customFields', key]);
  }
});

test('field resolution replaces options and required flags without leaking sibling or tenant definitions', () => {
  const root = field(300, 'choice', 'single_select', 0, { required: true, options: [option(500)] });
  const child = field(301, 'choice', 'multi_select', 3, { options: [option(501)] });
  const sibling = field(302, 'sibling', 'text', 3, { ownerId: id(99) });
  const foreign = field(303, 'foreign', 'text', 0, { workspaceId: id(9), ownerId: id(9) });
  const result = contracts.resolveFields({ scopes, definitions: [root, child, sibling, foreign] });
  expect(result).toMatchObject({
    success: true,
    items: [
      {
        id: child.id,
        type: 'multi_select',
        required: false,
        options: child.options,
        isInherited: false,
      },
    ],
  });
  expect(result.items[0].source.fieldId).toBe(child.id);
  expect(contracts.resolveFields({ scopes, definitions: [] })).toEqual({
    success: true,
    items: [],
  });
});

test('malformed paths, duplicate definitions and illegal options fail with typed issues', () => {
  const cases = [
    { scopes: scopes.slice(1), definitions: [] },
    { scopes, definitions: [field(400, 'same'), field(401, 'same')] },
    { scopes, definitions: [field(402, 'one'), field(402, 'two', 'number', 1)] },
    { scopes, definitions: [field(403, 'wrong', 'text', 0, { options: [option(500)] })] },
    {
      scopes,
      definitions: [
        field(404, 'wrong', 'single_select', 0, { options: [option(500), option(500)] }),
      ],
    },
    { scopes, definitions: [field(405, 'wrong', 'checkbox', 0, { required: 'true' })] },
    { scopes, definitions: [field(406, 'wrong', 'text', 0, { ownerId: id(9) })] },
  ];
  for (const input of cases) {
    const result = contracts.resolveFields(input);
    expect(result.success).toBe(false);
    expect(contracts.FieldResolutionResultSchema.safeParse(result).success).toBe(true);
  }
  expect(
    contracts.FieldDefinitionSchema.safeParse(field(407, 'empty_options', 'single_select')).success,
  ).toBe(true);
  expect(
    contracts.FieldDefinitionSchema.safeParse(
      field(408, 'labels', 'single_select', 0, { options: [option(500), option(501)] }),
    ).success,
  ).toBe(true);
});

test('local and effective field limits allow 100 but reject 101', () => {
  const many = Array.from({ length: 100 }, (_, index) =>
    field(1000 + index, `f_${index}`, 'checkbox'),
  );
  expect(contracts.resolveFields({ scopes, definitions: many }).success).toBe(true);
  expect(
    contracts.resolveFields({ scopes, definitions: [...many, field(2000, 'extra')] }).success,
  ).toBe(false);
  expect(
    contracts.resolveFields({ scopes, definitions: [...many, field(2000, 'extra', 'text', 3)] })
      .success,
  ).toBe(false);
  expect(
    contracts.resolveFields({ scopes, definitions: [...many, field(2000, 'f_0', 'number', 3)] })
      .success,
  ).toBe(true);
});

test('required values distinguish missing, blank, zero, false and empty selection', () => {
  expect(contracts.validateTaskFields({ values: {}, fields: resolved() })).toHaveLength(6);
  for (const [key, value] of [
    ['note', ' \n\t'],
    ['tags', []],
    ['confirmed', null],
  ]) {
    expect(
      contracts
        .validateTaskFields({ values: { ...valid, [key]: value }, fields: resolved() })
        .some((issue) => issue.path[1] === key),
    ).toBe(true);
  }
  expect(
    contracts.validateTaskFields({
      values: { ...valid, effort: -0.25, confirmed: false },
      fields: resolved(),
    }),
  ).toEqual([]);
  expect(
    contracts.validateTaskFields({ values: {}, fields: resolved([field(5000, 'optional')]) }),
  ).toEqual([]);
});

test.each([
  ['effort', NaN],
  ['effort', Infinity],
  ['effort', -Infinity],
  ['note', '\u0000'],
  ['note', '\ud800'],
  ['tags', [id(501), id(501)]],
  ['tags', [id(999)]],
  ['tags', ['invalid']],
  ['tags', 'invalid'],
  ['team', id(501)],
  ['team', 'Choice'],
  ['start_date', '1900-02-29'],
  ['start_date', '0000-01-01'],
  ['start_date', '2026-04-31'],
  ['start_date', '2026-01-01T00:00:00.000Z'],
  ['confirmed', 1],
])('invalid %s values return field paths without coercion', (key, value) => {
  const issues = contracts.validateTaskFields({
    values: { ...valid, [key]: value },
    fields: resolved(),
  });
  expect(issues.length).toBeGreaterThan(0);
  expect(issues[0].path.slice(0, 2)).toEqual(['customFields', key]);
  for (const issue of issues)
    expect(contracts.ValidationIssueSchema.safeParse(issue).success).toBe(true);
});

test('multi-select errors identify the item and option IDs compare canonically', () => {
  const choice = { ...option(900), id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const fields = resolved([
    field(800, 'selected', 'single_select', 0, { options: [choice] }),
    field(801, 'multiple', 'multi_select', 0, { options: [choice] }),
  ]);
  expect(
    contracts.validateTaskFields({
      values: { selected: choice.id.toUpperCase(), multiple: [choice.id.toUpperCase()] },
      fields,
    }),
  ).toEqual([]);
  const issues = contracts.validateTaskFields({
    values: { multiple: [choice.id, choice.id.toUpperCase()] },
    fields,
  });
  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate_option', path: ['customFields', 'multiple', 1] }),
    ]),
  );
  expect(
    contracts.FieldDefinitionSchema.safeParse(
      field(802, 'options', 'single_select', 0, {
        options: [choice, { ...choice, id: choice.id.toUpperCase() }],
      }),
    ).success,
  ).toBe(false);
});

test('Unicode lengths, key count and exact UTF-8 JSON byte boundaries are enforced', () => {
  const fields = resolved([field(700, 'note')]);
  expect(contracts.validateTaskFields({ values: { note: '😀'.repeat(2000) }, fields })).toEqual([]);
  expect(
    contracts.validateTaskFields({ values: { note: '😀'.repeat(2001) }, fields }).length,
  ).toBeGreaterThan(0);
  const many = resolved(
    Array.from({ length: 10 }, (_, index) => field(1000 + index, `f_${index}`)),
  );
  const values = Object.fromEntries(many.map((item) => [item.key, '']));
  const overhead = new TextEncoder().encode(JSON.stringify(values)).length;
  for (let index = 0; index < 9; index += 1) values[`f_${index}`] = 'x'.repeat(2000);
  values.f_9 = 'x'.repeat(20000 - overhead - 18000);
  expect(new TextEncoder().encode(JSON.stringify(values))).toHaveLength(20000);
  expect(contracts.validateTaskFields({ values, fields: many })).toEqual([]);
  expect(
    contracts.validateTaskFields({ values: { ...values, f_9: values.f_9 + 'x' }, fields: many })
      .length,
  ).toBeGreaterThan(0);
  const hundred = Array.from({ length: 100 }, (_, index) =>
    field(4000 + index, `key_${index}`, 'checkbox'),
  );
  const booleans = Object.fromEntries(hundred.map((item) => [item.key, false]));
  expect(contracts.validateTaskFields({ values: booleans, fields: resolved(hundred) })).toEqual([]);
  expect(
    contracts.validateTaskFields({
      values: { ...booleans, extra: false },
      fields: resolved(hundred),
    }).length,
  ).toBeGreaterThan(0);
});

test('patch omission retains values while null removes optional and source-only keys', () => {
  const fields = resolved([...definitions, field(900, 'optional')]);
  const current = { ...valid, optional: 'Keep', retired: 2 };
  Object.freeze(current.tags);
  Object.freeze(current);
  const patch = Object.freeze({ effort: 4, optional: null, retired: null });
  const result = contracts.applyTaskFieldPatch({ current, patch, fields });
  expect(result).toEqual({ success: true, values: { ...valid, effort: 4 } });
  expect(current.optional).toBe('Keep');
  expect(current.retired).toBe(2);
  expect(contracts.applyTaskFieldPatch({ current, patch: { retired: null }, fields })).toEqual({
    success: true,
    values: { ...valid, optional: 'Keep' },
  });
  expect(
    contracts.applyTaskFieldPatch({ current: valid, patch: { note: null }, fields }).success,
  ).toBe(false);
  expect(
    contracts.applyTaskFieldPatch({ current: valid, patch: { unknown: null }, fields }).success,
  ).toBe(false);
  expect(contracts.applyTaskFieldPatch({ current, patch: {}, fields }).success).toBe(false);
});

test('unknown/prototype keys fail closed and inherited properties never satisfy required values', () => {
  const fields = resolved([field(100, 'constructor', 'text', 0, { required: true })]);
  expect(contracts.validateTaskFields({ values: {}, fields }).length).toBeGreaterThan(0);
  expect(contracts.validateTaskFields({ values: { constructor: 'Real value' }, fields })).toEqual(
    [],
  );
  expect(
    contracts.validateTaskFields({ values: JSON.parse('{"__proto__":"fake"}'), fields }).length,
  ).toBeGreaterThan(0);
  expect(
    contracts.validateTaskFields({ values: Object.create({ constructor: 'Inherited' }), fields })
      .length,
  ).toBeGreaterThan(0);
  expect(contracts.validateTaskFields({ values: [], fields }).length).toBeGreaterThan(0);
  expect(contracts.validateTaskFields({ values: { unknown: true }, fields: [] })[0].code).toBe(
    'unknown_field',
  );
});

test('malformed patch schemas fail with typed results rather than throwing', () => {
  const result = contracts.applyTaskFieldPatch({ current: {}, patch: {}, fields: [undefined] });
  expect(result.success).toBe(false);
  expect(contracts.FieldValuesResultSchema.safeParse(result).success).toBe(true);
});

test('resolver and value helpers keep inputs immutable and examples satisfy their schemas', () => {
  const input = [
    field(970, 'zeta', 'text', 0, { position: 0 }),
    field(971, 'alpha', 'text', 3, { position: 0 }),
  ];
  for (const row of input) {
    Object.freeze(row.options);
    Object.freeze(row);
  }
  Object.freeze(input);
  const result = contracts.resolveFields({
    scopes: Object.freeze([...scopes]),
    definitions: input,
  });
  expect(result.items.map((item) => item.key)).toEqual(['alpha', 'zeta']);
  expect(contracts.FieldResolutionResultSchema.safeParse(result).success).toBe(true);
  for (const schema of [
    contracts.CustomFieldOptionSchema,
    contracts.FieldDefinitionSchema,
    contracts.ResolvedFieldSchema,
    contracts.FieldSourceSchema,
    contracts.FieldValuesSchema,
    contracts.FieldPatchSchema,
  ]) {
    expect(schema.safeParse(schema.meta().example).success).toBe(true);
  }
  const mapped = contracts.applyTaskFieldPatch({
    current: Object.create(null),
    patch: { alpha: '  Preserve whitespace  ' },
    fields: result.items,
  });
  expect(mapped).toEqual({ success: true, values: { alpha: '  Preserve whitespace  ' } });
  expect(contracts.FieldValuesResultSchema.safeParse(mapped).success).toBe(true);
});

test('patches canonicalize option IDs and isolate returned arrays', () => {
  const choice = { ...option(900), id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const fields = resolved([
    field(800, 'selected', 'single_select', 0, { options: [choice] }),
    field(801, 'multiple', 'multi_select', 0, { options: [choice] }),
  ]);
  const current = Object.freeze({ multiple: Object.freeze([choice.id.toUpperCase()]) });
  const result = contracts.applyTaskFieldPatch({
    current,
    patch: { selected: choice.id.toUpperCase() },
    fields,
  });
  expect(result).toEqual({ success: true, values: { multiple: [choice.id], selected: choice.id } });
  result.values.multiple.push(choice.id);
  expect(current.multiple).toHaveLength(1);
});

test('invalid keys and oversized errors remain safe typed results', () => {
  for (const key of ['\u0000', '\ud800', 'x'.repeat(1000), '__proto__']) {
    const values = Object.fromEntries([[key, 'value']]);
    const issues = contracts.validateTaskFields({ values, fields: [] });
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues)
      expect(contracts.ValidationIssueSchema.safeParse(issue).success).toBe(true);
    expect(issues[0].path).toEqual(['customFields']);
  }
  const manyOptions = Array.from({ length: 101 }, (_, index) => option(6000 + index));
  expect(
    contracts.FieldDefinitionSchema.safeParse(
      field(600, 'many', 'single_select', 0, { options: manyOptions }),
    ).success,
  ).toBe(false);
  expect(
    contracts.validateTaskFields({ values: { note: 'valid' }, fields: [undefined] })[0].code,
  ).toBe('invalid_schema');
});

test.each([42, null, { id: id(501) }])(
  'wrong-typed multi-select items keep their precise index',
  (value) => {
    const issues = contracts.validateTaskFields({
      values: { ...valid, tags: [id(501), value] },
      fields: resolved(),
    });
    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['customFields', 'tags', 1] })]),
    );
  },
);

test('stored-value and patch schemas reject forbidden keys before parser sanitization', () => {
  const value = JSON.parse('{"__proto__": "not a field"}');
  expect(contracts.FieldValuesSchema.safeParse(value).success).toBe(false);
  expect(contracts.FieldPatchSchema.safeParse(value).success).toBe(false);
});

test('guarded value and patch schemas remain exportable for generated API contracts', () => {
  for (const schema of [contracts.FieldValuesSchema, contracts.FieldPatchSchema]) {
    for (const io of ['input', 'output']) {
      const exported = z.toJSONSchema(schema, { io });
      expect(exported.type).toBe('object');
      expect(exported.additionalProperties).toBeDefined();
    }
  }
});

test('select option colors are optional but supplied colors stay strictly validated', () => {
  const withoutColor = { id: id(900), label: 'Uncolored' };
  expect(contracts.CustomFieldOptionSchema.parse(withoutColor)).toEqual(withoutColor);
  expect(
    contracts.resolveFields({
      scopes,
      definitions: [field(901, 'choice', 'single_select', 0, { options: [withoutColor] })],
    }).success,
  ).toBe(true);
  for (const color of ['', null, 'red', '#abc'])
    expect(contracts.CustomFieldOptionSchema.safeParse({ ...withoutColor, color }).success).toBe(
      false,
    );
});
