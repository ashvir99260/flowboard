import { expect, test } from '@jest/globals';

import * as contracts from '../dist/index.js';

const id = (n) => `81000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const activity = {
  id: id(1),
  workspaceId: id(2),
  taskId: id(3),
  eventId: id(4),
  actor: { id: id(5), name: 'Alice' },
  type: 'task.status_changed',
  payload: {
    beforeStatusId: id(6),
    afterStatusId: id(7),
    occurredAt: '2026-10-24T10:00:00.000Z',
    taskVersion: 2,
  },
  createdAt: '2026-10-24T10:00:01.000Z',
  updatedAt: '2026-10-24T10:00:01.000Z',
};

test('activity exposes only typed status changes and a safe historical actor summary', () => {
  expect(contracts.ActivitySchema.parse(activity)).toEqual(activity);
  for (const invalid of [
    { ...activity, actor: { ...activity.actor, email: 'private@example.test' } },
    { ...activity, payload: { ...activity.payload, taskVersion: 0 } },
    {
      ...activity,
      payload: { ...activity.payload, afterStatusId: activity.payload.beforeStatusId },
    },
    { ...activity, type: 'unknown' },
  ])
    expect(contracts.ActivitySchema.safeParse(invalid).success).toBe(false);
});
