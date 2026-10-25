import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { getContrastRatio } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';

import * as UI from '../dist/index.js';

afterEach(cleanup);

test('status and select badges use the saved color as fill with readable text', () => {
  for (const color of ['#FFFFFF', '#000000', '#808080', '#245CC5', '#F4C430']) {
    render(createElement(UI.StatusChip, { status: { category: 'active', color, name: 'Review' } }));
    const chip = screen.getByText('Review · Active').closest('.MuiChip-root');
    assert.ok(chip.classList.contains('MuiChip-filled'));
    assert.ok(getContrastRatio(chip.style.backgroundColor, chip.style.color) >= 4.5);
    cleanup();
    render(
      createElement(UI.CustomFieldChip, {
        field: {
          name: 'Team',
          type: 'single_select',
          options: [{ id: 'a', label: 'Design', color }],
        },
        value: 'a',
      }),
    );
    const field = screen.getByText('Team: Design').closest('.MuiChip-root');
    assert.ok(field.classList.contains('MuiChip-filled'));
    assert.equal(field.style.backgroundColor, chip.style.backgroundColor);
    assert.ok(getContrastRatio(field.style.backgroundColor, field.style.color) >= 4.5);
    cleanup();
  }
});

test('every priority badge is filled and unknown select values retain neutral fill', () => {
  for (const priority of ['urgent', 'high', 'normal', 'low', 'none']) {
    const { container } = render(createElement(UI.PriorityBadge, { priority }));
    assert.ok(container.querySelector('.MuiChip-filled'));
    cleanup();
  }
  const { container } = render(
    createElement(UI.CustomFieldChip, {
      field: { name: 'Team', type: 'single_select', options: [] },
      value: 'gone',
    }),
  );
  assert.ok(container.querySelector('.MuiChip-filled'));
  assert.ok(screen.getByText('Team: Unknown option'));
});

test('status communicates its name and category independently of its accent color', () => {
  render(
    createElement(UI.StatusChip, {
      status: { category: 'active', color: '#FFFFFF', name: 'Ready for review' },
    }),
  );
  assert.ok(screen.getByText('Ready for review · Active'));
});

test('all status categories and priority levels have visible text', () => {
  for (const [category, label] of Object.entries({
    active: 'Active',
    closed: 'Closed',
    done: 'Done',
    not_started: 'Not started',
  })) {
    render(
      createElement(UI.StatusChip, { status: { name: 'Custom', category, color: '#000000' } }),
    );
    assert.ok(screen.getByText(`Custom · ${label}`));
    cleanup();
  }
  for (const [priority, label] of Object.entries({
    high: 'High',
    low: 'Low',
    none: 'No priority',
    normal: 'Normal',
    urgent: 'Urgent',
  })) {
    render(createElement(UI.PriorityBadge, { priority }));
    assert.ok(screen.getByText(label));
    cleanup();
  }
});

test('assignees expose every full name even when avatars overflow, and empty tasks say unassigned', () => {
  render(createElement(UI.AssigneeAvatarGroup, { assignees: [] }));
  assert.ok(screen.getByText('Unassigned'));
  cleanup();
  const assignees = ['Élodie Rivera', 'Bob Jones', 'Carol Wu', 'Dana Kim', 'Evan Li'].map(
    (name, id) => ({ id: String(id), name }),
  );
  render(createElement(UI.AssigneeAvatarGroup, { assignees }));
  assert.ok(
    screen.getByRole('img', {
      name: 'Assignees: Élodie Rivera, Bob Jones, Carol Wu, Dana Kim, Evan Li',
    }),
  );
  assert.ok(screen.getByText('ÉR'));
  assert.ok(screen.getByText('+2'));
});

test('due dates distinguish unset, calendar-day, overdue and invalid values', () => {
  render(createElement(UI.DueDateLabel, { date: null }));
  assert.ok(screen.getByText('No due date'));
  cleanup();
  render(createElement(UI.DueDateLabel, { date: '2024-02-29', overdue: true }));
  assert.equal(screen.getByText('Overdue · Feb 29, 2024').getAttribute('datetime'), '2024-02-29');
  cleanup();
  render(createElement(UI.DueDateLabel, { date: '2024-02-30' }));
  assert.ok(screen.getByText('Invalid date'));
});

test('custom field displays preserve zero/false and resolve select values by ID', () => {
  const options = [
    { color: '#336699', id: 'a', label: 'Design' },
    { color: '#663399', id: 'b', label: 'Engineering' },
  ];
  const cases = [
    ['number', 0, 'Field: 0'],
    ['number', 1e-21, 'Field: 1e-21'],
    ['number', -1e-21, 'Field: -1e-21'],
    ['checkbox', false, 'Field: No'],
    ['checkbox', true, 'Field: Yes'],
    ['text', '<img src=x>', 'Field: <img src=x>'],
    ['date', '2024-02-29', 'Field: Feb 29, 2024'],
    ['single_select', 'b', 'Field: Engineering'],
    ['single_select', 'missing', 'Field: Unknown option'],
    ['multi_select', ['b', 'a'], 'Field: Engineering, Design'],
    ['number', '0', 'Field: Invalid value'],
    ['text', undefined, 'Field: Not set'],
    ['text', null, 'Field: Not set'],
    ['multi_select', [], 'Field: Not set'],
  ];
  for (const [type, value, label] of cases) {
    render(createElement(UI.CustomFieldChip, { field: { name: 'Field', type, options }, value }));
    assert.ok(screen.getByText(label));
    assert.equal(screen.queryByRole('img'), null);
    cleanup();
  }
});

test('empty and error states expose their message and working action slot', () => {
  let actions = 0;
  const action = createElement(
    'button',
    {
      onClick: () => {
        actions += 1;
      },
    },
    'Try again',
  );
  render(
    createElement(UI.EmptyState, {
      title: 'No tasks yet',
      description: 'Create your first task.',
      action,
    }),
  );
  assert.ok(screen.getByRole('status', { name: 'No tasks yet' }));
  assert.ok(screen.getByText('Create your first task.'));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  cleanup();
  render(
    createElement(UI.ErrorState, {
      title: 'Unable to load tasks',
      description: 'Please retry.',
      action,
    }),
  );
  assert.ok(screen.getByRole('alert', { name: 'Unable to load tasks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  assert.equal(actions, 2);
});

test('both themes provide readable text and primary controls on their surfaces', () => {
  for (const mode of ['light', 'dark']) {
    const { palette } = UI.theme.colorSchemes[mode];
    for (const surface of [palette.background.default, palette.background.paper]) {
      assert.ok(getContrastRatio(palette.text.primary, surface) >= 4.5);
      assert.ok(getContrastRatio(palette.text.secondary, surface) >= 4.5);
    }
    assert.ok(getContrastRatio(palette.primary.main, palette.primary.contrastText) >= 4.5);
    for (const name of ['secondary', 'error', 'warning', 'success', 'info'])
      assert.ok(
        getContrastRatio(palette[name].main, palette[name].contrastText) >= 4.5,
        `${mode} ${name} contrast`,
      );
  }
});
