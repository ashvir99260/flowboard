import { expect, test } from '@jest/globals';

import {
  BulkTaskMutationEnvelopeSchema,
  BulkUpdateTasksSchema,
  TaskSchema,
} from '../dist/index.js';

const id = (value) => `a1000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const command = {
  expectedConfigVersion: 1,
  tasks: [{ id: id(1), expectedVersion: 2 }],
  patch: { priority: 'high' },
};

test('bulk targets are bounded, unique normalized identities with version preconditions', () => {
  expect(BulkUpdateTasksSchema.parse(command)).toEqual(command);
  expect(
    BulkUpdateTasksSchema.parse({
      ...command,
      tasks: [{ id: id(1).toUpperCase(), expectedVersion: 2 }],
    }).tasks[0].id,
  ).toBe(id(1));
  for (const tasks of [
    [],
    Array.from({ length: 51 }, (_, index) => ({ id: id(index + 1), expectedVersion: 1 })),
    [
      { id: id(1), expectedVersion: 1 },
      { id: id(1).toUpperCase(), expectedVersion: 2 },
    ],
    [{ id: id(1), expectedVersion: 0 }],
    [{ expectedVersion: 1, id: 'invalid' }],
  ])
    expect(BulkUpdateTasksSchema.safeParse({ ...command, tasks }).success).toBe(false);
});

test('bulk patch is restricted and preserves explicit clear commands', () => {
  for (const patch of [
    {},
    { priority: undefined },
    { customFields: {} },
    { title: 'Not a bulk field' },
    { parentTaskId: id(2) },
    { assigneeIds: [id(1), id(1)] },
    { priority: null },
  ])
    expect(BulkUpdateTasksSchema.safeParse({ ...command, patch }).success).toBe(false);
  expect(
    BulkUpdateTasksSchema.parse({
      ...command,
      patch: { assigneeIds: [], customFields: { effort: null } },
    }).patch,
  ).toEqual({ assigneeIds: [], customFields: { effort: null } });
  expect(BulkUpdateTasksSchema.safeParse({ ...command, workspaceId: id(3) }).success).toBe(false);
});

test('bulk responses expose bounded unique tasks and only changed response identities', () => {
  const task = TaskSchema.parse(TaskSchema.meta().example);
  const response = { data: [task], configVersion: 1, dataVersion: 2, changedTaskIds: [task.id] };
  expect(BulkTaskMutationEnvelopeSchema.parse(response)).toEqual(response);
  expect(
    BulkTaskMutationEnvelopeSchema.safeParse({ ...response, changedTaskIds: [id(9)] }).success,
  ).toBe(false);
  expect(
    BulkTaskMutationEnvelopeSchema.safeParse({ ...response, data: [task, task] }).success,
  ).toBe(false);
});
