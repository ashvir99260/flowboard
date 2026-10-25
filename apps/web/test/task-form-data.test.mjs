import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTaskInput,
  taskDefaults,
  taskDraftSchema,
  updateTaskInput,
} from '../src/features/tasks/task-form-data.ts';

import { boardFixture, field } from './common/board-fixture.mjs';

test('task form defaults preserve zero and false and explicitly represent unset fields', () => {
  const fixture = boardFixture();
  const fields = [field('effort', 'number'), field('approved', 'checkbox'), field('note', 'text')];
  const task = {
    ...fixture.pages[0].response.items[0],
    customFields: { approved: false, effort: 0 },
  };
  const draft = taskDefaults(fields, fixture.statuses.items, task);
  assert.equal(draft.title, task.title);
  assert.deepEqual(draft.customFields, { approved: false, effort: 0, note: null });
  assert.deepEqual(taskDefaults(fields, fixture.statuses.items), {
    title: '',
    description: '',
    statusId: fixture.statuses.items[0].id,
    priority: 'none',
    assigneeIds: [],
    dueDate: null,
    parentTaskId: null,
    customFields: { approved: null, effort: null, note: null },
  });
});

test('task requests omit unchanged fields, explicitly clear removed values and never send actor identity', () => {
  const fixture = boardFixture();
  const fields = [field('effort', 'number'), field('approved', 'checkbox', false, 1)];
  const task = {
    ...fixture.pages[0].response.items[0],
    customFields: { approved: false, effort: 5 },
  };
  const initial = taskDefaults(fields, fixture.statuses.items, task);
  assert.equal(updateTaskInput(initial, task, 7), null);
  assert.deepEqual(
    updateTaskInput(
      { ...initial, title: 'Changed', customFields: { approved: false, effort: null } },
      task,
      7,
    ),
    {
      expectedVersion: task.version,
      expectedConfigVersion: 7,
      title: 'Changed',
      customFields: { effort: null },
    },
  );
  assert.deepEqual(
    createTaskInput({ ...initial, customFields: { approved: false, effort: null } }, 7),
    {
      title: task.title,
      description: task.description,
      statusId: task.statusId,
      priority: task.priority,
      assigneeIds: task.assigneeIds,
      dueDate: task.dueDate,
      parentTaskId: null,
      customFields: { approved: false },
      expectedConfigVersion: 7,
    },
  );
});

test('task drafts validate shared title/status rules and resolved required, option and field types', () => {
  const { statuses } = boardFixture();
  const fields = [field('effort', 'number', true), field('area', 'single_select', true, 1)];
  const schema = taskDraftSchema(fields, statuses.items);
  const draft = {
    ...taskDefaults(fields, statuses.items),
    title: 'Review',
    customFields: { effort: 0, area: fields[1].options[0].id },
  };
  assert.equal(schema.safeParse(draft).success, true);
  for (const [key, value, expectedPath] of [
    ['title', 'x'.repeat(501), ['title']],
    ['statusId', '10000000-0000-4000-8000-000000000999', ['statusId']],
    ['customFields', { effort: null, area: fields[1].options[0].id }, ['customFields', 'effort']],
    [
      'customFields',
      { effort: 'wrong', area: fields[1].options[0].id },
      ['customFields', 'effort'],
    ],
    [
      'customFields',
      { area: '10000000-0000-4000-8000-000000000999', effort: 0 },
      ['customFields', 'area'],
    ],
  ]) {
    const result = schema.safeParse({ ...draft, [key]: value });
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some(
        (issue) => JSON.stringify(issue.path) === JSON.stringify(expectedPath),
      ),
    );
  }
});

test('UTC datetime drafts preserve milliseconds and only send real due-time changes', () => {
  const fixture = boardFixture();
  const task = { ...fixture.pages[0].response.items[0], dueDate: '2026-06-10T12:45:30.123Z' };
  const draft = taskDefaults([], fixture.statuses.items, task);
  assert.equal(draft.dueDate, '2026-06-10T12:45:30.123');
  assert.equal(updateTaskInput(draft, task, 7), null);
  assert.equal(createTaskInput(draft, 7).dueDate, task.dueDate);
  assert.equal(
    updateTaskInput({ ...draft, dueDate: '2026-06-10T13:00' }, task, 7).dueDate,
    '2026-06-10T13:00:00.000Z',
  );
  assert.equal(updateTaskInput({ ...draft, dueDate: null }, task, 7).dueDate, null);
  assert.throws(() => createTaskInput({ ...draft, dueDate: '2026-06-10' }, 7));
});

test('subtask drafts preserve, attach and explicitly clear the parent without copying parent fields', () => {
  const fixture = boardFixture();
  const parent = fixture.pages[0].response.items[0];
  const initial = taskDefaults([], fixture.statuses.items, undefined, parent.id);
  assert.equal(initial.parentTaskId, parent.id);
  assert.equal(initial.title, '');
  assert.deepEqual(initial.customFields, {});
  assert.equal(createTaskInput({ ...initial, title: 'Child' }, 7).parentTaskId, parent.id);
  const child = { ...parent, id: '10000000-0000-4000-8000-000000000999', parentTaskId: parent.id };
  const draft = taskDefaults([], fixture.statuses.items, child);
  assert.equal(updateTaskInput(draft, child, 7), null);
  assert.equal('parentTaskId' in updateTaskInput({ ...draft, title: 'Edited' }, child, 7), false);
  assert.deepEqual(updateTaskInput({ ...draft, parentTaskId: null }, child, 7), {
    parentTaskId: null,
    expectedConfigVersion: 7,
    expectedVersion: child.version,
  });
  assert.equal(
    taskDraftSchema([], fixture.statuses.items).safeParse({ ...draft, parentTaskId: 'invalid' })
      .success,
    false,
  );
});
