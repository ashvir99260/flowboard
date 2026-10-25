import { expect, test } from '@jest/globals';

import {
  CreateTaskSchema,
  ListTasksQuerySchema,
  TaskSchema,
  TaskUpdatedEventSchema,
  UpdateTaskSchema,
} from '../dist/index.js';

const parentTaskId = '10000000-0000-4000-8000-000000000100';
const statusId = '10000000-0000-4000-8000-000000000101';

test('task parent input distinguishes creation default, retained omission and explicit detach', () => {
  const create = { title: 'Child', statusId, expectedConfigVersion: 1 };
  expect(CreateTaskSchema.parse(create).parentTaskId).toBeNull();
  expect(CreateTaskSchema.parse({ ...create, parentTaskId }).parentTaskId).toBe(parentTaskId);
  const update = { expectedConfigVersion: 1, expectedVersion: 1, title: 'Retained' };
  expect(UpdateTaskSchema.parse(update)).not.toHaveProperty('parentTaskId');
  expect(UpdateTaskSchema.parse({ ...update, parentTaskId: null }).parentTaskId).toBeNull();
  expect(ListTasksQuerySchema.parse({ parentTaskId }).parentTaskId).toBe(parentTaskId);
  expect(TaskSchema.shape.parentTaskId.safeParse(null).success).toBe(true);
  expect(TaskSchema.shape.parentTaskId.safeParse(undefined).success).toBe(false);
  expect(CreateTaskSchema.safeParse({ ...create, parentTaskId: 'not-a-task' }).success).toBe(false);
});

test('parent events accept old payloads but reject unchanged and self-referencing links', () => {
  const event = {
    eventId: parentTaskId,
    workspaceId: parentTaskId,
    actorId: parentTaskId,
    schemaVersion: 1,
    occurredAt: '2026-10-25T12:00:00.000Z',
    taskId: statusId,
    taskVersion: 2,
    previousListId: parentTaskId,
    currentListId: parentTaskId,
    changes: { title: true },
  };
  expect(TaskUpdatedEventSchema.safeParse(event).success).toBe(true);
  expect(
    TaskUpdatedEventSchema.safeParse({
      ...event,
      changes: { parentTaskId: { before: null, after: parentTaskId } },
    }).success,
  ).toBe(true);
  expect(
    TaskUpdatedEventSchema.safeParse({
      ...event,
      changes: { parentTaskId: { before: parentTaskId, after: parentTaskId } },
    }).success,
  ).toBe(false);
  expect(
    TaskUpdatedEventSchema.safeParse({
      ...event,
      changes: { parentTaskId: { before: null, after: statusId } },
    }).success,
  ).toBe(false);
});
