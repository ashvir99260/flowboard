import { expect, test } from '@jest/globals';

import * as contracts from '../dist/index.js';

const id = (n) => `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const common = {
  eventId: id(1),
  workspaceId: id(2),
  actorId: id(3),
  schemaVersion: 1,
  occurredAt: '2026-10-24T00:00:00.000Z',
};
const events = [
  [
    'task.created',
    'task',
    { ...common, taskId: id(4), taskVersion: 2, currentListId: id(5), statusId: id(6) },
    id(4),
    2,
  ],
  [
    'task.updated',
    'task',
    {
      ...common,
      taskId: id(4),
      taskVersion: 2,
      previousListId: id(5),
      currentListId: id(5),
      changes: { title: true },
    },
    id(4),
    2,
  ],
  [
    'node.updated',
    'node',
    { ...common, nodeId: id(4), nodeVersion: 2, operation: 'archived' },
    id(4),
    2,
  ],
  [
    'workspace.config.updated',
    'workspace_config',
    { ...common, configVersion: 2, reason: 'field' },
    id(2),
    2,
  ],
];

test('queue jobs contain only a strict tenant-scoped event reference', () => {
  const valid = { schemaVersion: 1, eventId: id(1), workspaceId: id(2) };
  expect(contracts.EventJobReferenceSchema.parse(valid)).toEqual(valid);
  for (const invalid of [
    { ...valid, token: 'lease' },
    { ...valid, schemaVersion: 2 },
    { ...valid, eventId: 'unknown' },
    { eventId: id(1) },
  ])
    expect(contracts.EventJobReferenceSchema.safeParse(invalid).success).toBe(false);
});

test.each(events)(
  'validates persisted %s identity without requiring the latest aggregate version',
  (eventType, aggregateType, payload, aggregateId, aggregateVersion) => {
    const row = {
      id: common.eventId,
      workspaceId: common.workspaceId,
      actorId: common.actorId,
      schemaVersion: 1,
      eventType,
      aggregateType,
      aggregateId,
      aggregateVersion,
      payload,
    };
    expect(contracts.OutboxRecordSchema.safeParse(row).success).toBe(true);
    for (const patch of [
      { id: id(9) },
      { workspaceId: id(9) },
      { actorId: id(9) },
      { aggregateId: id(9) },
      { aggregateVersion: 3 },
      { schemaVersion: 2 },
      { eventType: 'unknown' },
    ])
      expect(contracts.OutboxRecordSchema.safeParse({ ...row, ...patch }).success).toBe(false);
  },
);
