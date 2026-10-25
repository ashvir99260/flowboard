import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement as h, useState } from 'react';

import { TaskTable } from '../dist/index.js';

afterEach(cleanup);

const tasks = Array.from({ length: 51 }, (_, index) => ({
  id: String(index),
  title: `Task ${index}`,
  priority: 'normal',
  statusId: 'todo',
  assignees: [],
  dueDate: null,
  customFields: {},
}));

test('controlled table selection caps at fifty and checkbox clicks do not open the drawer', async () => {
  const opened = [];
  function Example() {
    const [selected, setSelected] = useState(tasks.slice(0, 49).map(({ id }) => id));

    return h(TaskTable, {
      items: tasks.slice(49),
      fields: [],
      statuses: [],
      onOpenTask: (id) => opened.push(id),
      selection: { ids: selected, onChange: setSelected },
    });
  }
  render(h(Example));
  const checkboxes = await screen.findAllByRole('checkbox');
  const fiftieth = checkboxes[1];
  assert.equal(fiftieth.checked, false);
  fireEvent.click(fiftieth);
  assert.equal(fiftieth.checked, true);
  assert.deepEqual(opened, []);
  assert.equal(screen.getAllByRole('checkbox').at(-1).disabled, true);
});

test('table selection remains controlled while title activation still opens a task', async () => {
  const changes = [];
  const opened = [];
  render(
    h(TaskTable, {
      items: tasks.slice(0, 2),
      fields: [],
      statuses: [],
      onOpenTask: (id) => opened.push(id),
      selection: { ids: [], onChange: (ids) => changes.push(ids) },
    }),
  );
  const checkboxes = await screen.findAllByRole('checkbox');
  fireEvent.click(checkboxes[1]);
  assert.deepEqual(changes, [['0']]);
  assert.equal(checkboxes[1].checked, false);
  fireEvent.click(screen.getByRole('button', { name: 'Open task: Task 0' }));
  assert.deepEqual(opened, ['0']);
});
