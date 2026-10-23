import { expect, test } from '@jest/globals';

import * as contracts from '../dist/index.js';

const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const time = '2026-10-24T00:00:00.000Z';
const scopes = ['workspace', 'space', 'folder', 'list'].map((ownerType, index) => ({
  ownerType,
  ownerId: id(index + 1),
}));
const identity = (n, key, category) => ({
  id: id(n),
  workspaceId: id(1),
  key,
  category,
  createdAt: time,
  updatedAt: time,
});
const override = (n, statusId, level, values = {}) => ({
  id: id(n),
  statusId,
  workspaceId: id(1),
  ...scopes[level],
  name: null,
  color: null,
  position: null,
  hidden: null,
  createdAt: time,
  updatedAt: time,
  ...values,
});
const identities = [
  identity(100, 'todo', 'not_started'),
  identity(101, 'doing', 'active'),
  identity(102, 'done', 'done'),
];
const overrides = identities.map((status, index) =>
  override(200 + index, status.id, 0, { name: status.key, color: '#334455', position: index }),
);

test('workspace defaults resolve to stable identity IDs with inherited provenance', () => {
  const result = contracts.resolveStatuses({ scopes, identities, overrides });
  expect(result.success).toBe(true);
  expect(
    result.items.map(({ id, key, category, name, color, position }) => ({
      id,
      key,
      category,
      name,
      color,
      position,
    })),
  ).toEqual([
    {
      id: id(100),
      key: 'todo',
      category: 'not_started',
      name: 'todo',
      color: '#334455',
      position: 0,
    },
    { id: id(101), key: 'doing', category: 'active', name: 'doing', color: '#334455', position: 1 },
    { id: id(102), key: 'done', category: 'done', name: 'done', color: '#334455', position: 2 },
  ]);
  expect(result.items[0]).toMatchObject({
    sourceOwner: scopes[0],
    isInherited: true,
    isLocal: false,
    isOverridden: false,
  });
  expect(result.items[0].provenance.name).toEqual({
    overrideId: id(200),
    ...scopes[0],
    createdAt: time,
    updatedAt: time,
  });
});

test('partial attributes inherit separately and explicit zero/false retain their provenance', () => {
  const patches = [
    override(300, id(101), 1, { name: 'In progress' }),
    override(301, id(101), 2, { color: '#AABBCC' }),
    override(302, id(101), 3, {
      hidden: false,
      position: 0,
      updatedAt: '2026-10-24T01:00:00.000Z',
    }),
  ];
  const result = contracts.resolveStatuses({
    scopes,
    identities,
    overrides: [...overrides, ...patches],
  });
  expect(result.success).toBe(true);
  const status = result.items.find((item) => item.key === 'doing');
  expect(status).toMatchObject({
    id: id(101),
    name: 'In progress',
    color: '#AABBCC',
    position: 0,
    category: 'active',
    isLocal: true,
    isInherited: true,
    isOverridden: true,
    sourceOwner: scopes[0],
  });
  expect(status.provenance.name.overrideId).toBe(id(300));
  expect(status.provenance.color.overrideId).toBe(id(301));
  expect(status.provenance.position.overrideId).toBe(id(302));
  expect(status.provenance.hidden.updatedAt).toBe('2026-10-24T01:00:00.000Z');
  expect(status.updatedAt).toBe(time);
});

test('hidden entries retain patches and only explicit false restores visibility', () => {
  const closed = identity(103, 'closed', 'closed');
  const rows = [
    ...overrides,
    override(203, closed.id, 0, { color: '#667788', name: 'Closed', position: 3 }),
    override(303, closed.id, 1, { hidden: true }),
    override(304, closed.id, 2, { name: 'Released' }),
  ];
  const hidden = contracts.resolveStatuses({
    scopes,
    identities: [...identities, closed],
    overrides: rows,
  });
  expect(hidden.success).toBe(true);
  expect(hidden.items.map((status) => status.key)).toEqual(['todo', 'doing', 'done']);
  const restored = contracts.resolveStatuses({
    scopes,
    identities: [...identities, closed],
    overrides: [...rows, override(305, closed.id, 3, { hidden: false })],
  });
  expect(restored.success).toBe(true);
  const status = restored.items.find((item) => item.key === 'closed');
  expect(status).toMatchObject({ id: closed.id, name: 'Released', color: '#667788', position: 3 });
  expect(status.provenance.name.overrideId).toBe(id(304));
  expect(status.provenance.hidden.overrideId).toBe(id(305));
});

test('a list can add a local status, and hiding another status in its category stays valid', () => {
  const blocked = identity(104, 'blocked', 'active');
  const result = contracts.resolveStatuses({
    scopes,
    identities: [...identities, blocked],
    overrides: [
      ...overrides,
      override(310, blocked.id, 3, { color: '#DD2200', name: 'Blocked', position: 1 }),
      override(311, id(101), 3, { hidden: true }),
    ],
  });
  expect(result.success).toBe(true);
  expect(result.items.map((status) => status.key)).toEqual(['todo', 'blocked', 'done']);
  expect(result.items[1]).toMatchObject({
    id: blocked.id,
    sourceOwner: scopes[3],
    isLocal: true,
    isInherited: false,
    isOverridden: false,
  });
});

test('sibling and foreign rows do not leak, even when siblings introduce the same identity', () => {
  const blocked = identity(104, 'blocked', 'active');
  const sibling = { ownerType: 'list', ownerId: id(5) };
  const foreign = identity(105, 'secret', 'active');
  foreign.workspaceId = id(9);
  const rows = [
    ...overrides,
    override(310, blocked.id, 3, { color: '#DD2200', name: 'Here', position: 1 }),
    {
      ...override(311, blocked.id, 3, { color: '#CC1100', name: 'Sibling only', position: 4 }),
      ...sibling,
    },
    {
      ...override(312, foreign.id, 3, { color: '#FF0000', name: 'Foreign secret', position: 0 }),
      workspaceId: id(9),
    },
  ];
  const here = contracts.resolveStatuses({
    scopes,
    identities: [...identities, blocked, foreign],
    overrides: rows,
  });
  const there = contracts.resolveStatuses({
    scopes: [...scopes.slice(0, 3), sibling],
    identities: [...identities, blocked, foreign],
    overrides: rows,
  });
  expect(here.success).toBe(true);
  expect(there.success).toBe(true);
  expect(here.items.find((status) => status.id === blocked.id).name).toBe('Here');
  expect(there.items.find((status) => status.id === blocked.id).name).toBe('Sibling only');
  expect(here.items.some((status) => status.id === foreign.id)).toBe(false);
});

test('input ordering is irrelevant and resolution does not mutate frozen inputs', () => {
  const input = { scopes, identities, overrides };
  const before = globalThis.structuredClone(input);
  for (const values of Object.values(input)) {
    for (const value of values) Object.freeze(value);
    Object.freeze(values);
  }
  Object.freeze(input);
  const expected = contracts.resolveStatuses(input);
  expect(
    contracts.resolveStatuses({
      scopes,
      identities: [...identities].reverse(),
      overrides: [...overrides].reverse(),
    }),
  ).toEqual(expected);
  expect(input).toEqual(before);
});

test('each required category is enforced, while closed remains optional', () => {
  for (const missing of identities) {
    const result = contracts.resolveStatuses({
      scopes,
      identities,
      overrides: overrides.filter((row) => row.statusId !== missing.id),
    });
    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual({
      code: 'missing_category',
      message: `At least one ${missing.category} status is required`,
      path: ['statuses', missing.category],
    });
  }
  expect(
    contracts
      .resolveStatuses({ scopes, identities, overrides: [] })
      .issues.filter((issue) => issue.code === 'missing_category'),
  ).toHaveLength(3);
  expect(contracts.resolveStatuses({ scopes, identities, overrides }).success).toBe(true);
});

test('unknown or duplicate identities and duplicate scope rows fail explicitly', () => {
  const cases = [
    {
      identities,
      overrides: [...overrides, override(310, id(999), 3, { hidden: false })],
      code: 'unknown_identity',
    },
    {
      identities: [...identities, identity(999, 'doing', 'closed')],
      overrides,
      code: 'duplicate_identity',
    },
    {
      identities: [...identities, identity(101, 'other', 'active')],
      overrides,
      code: 'duplicate_identity',
    },
    {
      identities,
      overrides: [...overrides, { ...overrides[0], id: id(999) }],
      code: 'duplicate_override',
    },
  ];
  for (const { code, ...input } of cases) {
    const result = contracts.resolveStatuses({ scopes, ...input });
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.code === code)).toBe(true);
  }
});

test('first introduction needs all display attributes and scope paths cannot skip levels', () => {
  for (const field of ['name', 'color', 'position']) {
    const result = contracts.resolveStatuses({
      scopes,
      identities,
      overrides: [{ ...overrides[0], [field]: null }, ...overrides.slice(1)],
    });
    expect(result.success).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === 'incomplete_definition' && issue.path.at(-1) === field,
      ),
    ).toBe(true);
  }
  for (const invalid of [[], scopes.slice(1), [scopes[0], scopes[2]], [scopes[0], scopes[0]]])
    expect(contracts.resolveStatuses({ scopes: invalid, identities, overrides }).success).toBe(
      false,
    );
});

test('schemas reject malformed attributes and protect identity fields from overrides', () => {
  for (const patch of [
    { position: -1 },
    { position: 0.5 },
    { color: 'red' },
    { name: '' },
    { category: 'closed' },
    { key: 'replacement' },
  ]) {
    const result = contracts.resolveStatuses({
      scopes,
      identities,
      overrides: [{ ...overrides[0], ...patch }, ...overrides.slice(1)],
    });
    expect(result.success).toBe(false);
    expect(result.issues[0].path[0]).toBe('overrides');
  }
  expect(
    contracts.StatusResolutionResultSchema.safeParse(
      contracts.resolveStatuses({ scopes, identities, overrides }),
    ).success,
  ).toBe(true);
});

test('per-scope and effective-set limits reject excessive definitions', () => {
  const extra = Array.from({ length: 98 }, (_, i) => identity(1000 + i, `extra_${i}`, 'active'));
  const rows = extra.map((status, i) =>
    override(2000 + i, status.id, 0, { name: status.key, color: '#334455', position: i + 3 }),
  );
  const result = contracts.resolveStatuses({
    scopes,
    identities: [...identities, ...extra],
    overrides: [...overrides, ...rows],
  });
  expect(result.success).toBe(false);
  expect(result.issues.some((issue) => issue.code === 'too_many_statuses')).toBe(true);
  const distributed = rows.map((row, i) => (i > 50 ? { ...row, ...scopes[3] } : row));
  const effective = contracts.resolveStatuses({
    scopes,
    identities: [...identities, ...extra],
    overrides: [...overrides, ...distributed],
  });
  expect(effective.success).toBe(false);
  expect(effective.issues).toContainEqual({
    code: 'too_many_statuses',
    message: 'A resolved set can contain at most 100 statuses',
    path: ['statuses'],
  });
});

test('tied positions sort by key and hiding the last active status invalidates the set', () => {
  const result = contracts.resolveStatuses({
    scopes,
    identities,
    overrides: overrides.map((row) => ({ ...row, position: 0 })),
  });
  expect(result.success).toBe(true);
  expect(result.items.map((status) => status.key)).toEqual(['doing', 'done', 'todo']);
  const hidden = contracts.resolveStatuses({
    scopes,
    identities,
    overrides: [...overrides, override(399, id(101), 3, { hidden: true })],
  });
  expect(hidden.success).toBe(false);
  expect(
    hidden.issues.some((issue) => issue.code === 'missing_category' && issue.path[1] === 'active'),
  ).toBe(true);
});

test('public model examples validate against their schemas', () => {
  for (const schema of [
    contracts.StatusScopeSchema,
    contracts.StatusIdentitySchema,
    contracts.StatusOverrideSchema,
    contracts.StatusSourceSchema,
    contracts.ResolvedStatusSchema,
  ])
    expect(schema.safeParse(schema.meta().example).success).toBe(true);
});

test('malformed input still returns bounded schema-valid issues without echoing unknown keys', () => {
  for (const key of ['x'.repeat(800), 'bad\u0000key', 'bad\uD800key']) {
    const result = contracts.resolveStatuses({ scopes, identities, overrides, [key]: true });
    expect(result.success).toBe(false);
    expect(contracts.StatusResolutionResultSchema.safeParse(result).success).toBe(true);
    expect(result.issues[0].message).not.toContain(key);
  }
});
