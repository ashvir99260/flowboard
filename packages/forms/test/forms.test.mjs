import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement as h } from 'react';
import { z } from 'zod';

import * as Forms from '../dist/index.js';

afterEach(cleanup);

const schema = z.object({
  profile: z.object({ email: z.email('Use a valid email') }),
  count: z.number(),
  visible: z.boolean().nullable(),
  tags: z.array(z.string()),
});
const fields = [
  { autoComplete: 'email', kind: 'email', label: 'Email', name: 'profile.email' },
  { kind: 'number', label: 'Count', name: 'count' },
  {
    kind: 'select',
    name: 'visible',
    label: 'Visibility',
    options: [
      { label: 'Inherit', value: null },
      { label: 'Hidden', value: false },
      { label: 'Visible', value: true },
    ],
  },
  {
    kind: 'multi_select',
    name: 'tags',
    label: 'Tags',
    options: [
      { label: 'Design', value: 'design' },
      { label: 'API', value: 'api' },
    ],
  },
];
function Fixture({ onSubmit, onValueChange, disabled = false }) {
  const form = Forms.useZodForm(schema, {
    defaultValues: { profile: { email: '' }, count: 0, visible: false, tags: [] },
  });

  return h(
    'form',
    { noValidate: true, onSubmit: form.handleSubmit(onSubmit) },
    h(Forms.FormFields, { control: form.control, fields, disabled, onValueChange }),
    h('button', { type: 'submit' }, 'Save'),
    h(
      'button',
      {
        type: 'button',
        onClick: () =>
          form.setError('profile.email', { message: 'Server email error' }, { shouldFocus: true }),
      },
      'Server error',
    ),
    h(
      'button',
      {
        type: 'button',
        onClick: () =>
          form.reset({
            profile: { email: 'reset@example.com' },
            count: 0,
            visible: null,
            tags: [],
          }),
      },
      'Reset',
    ),
    h('output', null, form.formState.isDirty ? 'Dirty' : 'Pristine'),
  );
}

test('shared public controls expose RHF and Zod integration', () => {
  for (const key of ['ControlledField', 'FormFields', 'useZodForm', 'parseFormFields'])
    assert.equal(typeof Forms[key], 'function', `${key} must be a public form API`);
});

test('JSON fields validate on blur, focus errors, preserve dirty state and reset through RHF', async () => {
  assert.equal(typeof Forms.FormFields, 'function');
  const saved = [];
  const changed = [];
  const result = render(
    h(Fixture, {
      onSubmit: (value) => saved.push(value),
      onValueChange: (...args) => changed.push(args),
    }),
  );
  const email = screen.getByLabelText('Email');
  fireEvent.change(email, { target: { value: 'invalid' } });
  fireEvent.blur(email);
  await screen.findByText('Use a valid email');
  assert.equal(email.getAttribute('aria-invalid'), 'true');
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => assert.ok(globalThis.document.activeElement === email));
  assert.equal(saved.length, 0);
  result.rerender(
    h(Fixture, {
      onSubmit: (value) => saved.push(value),
      onValueChange: (...args) => changed.push(args),
    }),
  );
  assert.equal(email.value, 'invalid');
  assert.ok(screen.getByText('Dirty'));
  fireEvent.change(email, { target: { value: 'alice@example.com' } });
  fireEvent.blur(email);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => assert.equal(saved.length, 1));
  assert.deepEqual(saved[0], {
    profile: { email: 'alice@example.com' },
    count: 0,
    visible: false,
    tags: [],
  });
  assert.deepEqual(changed.at(-1), ['profile.email', 'alice@example.com']);
  fireEvent.click(screen.getByText('Server error'));
  await screen.findByText('Server email error');
  assert.ok(globalThis.document.activeElement === email);
  fireEvent.click(screen.getByText('Reset'));
  await waitFor(() => assert.equal(email.value, 'reset@example.com'));
  assert.ok(screen.getByText('Pristine'));
});

test('visual disabled controls retain registered values in submitted data', async () => {
  assert.equal(typeof Forms.FormFields, 'function');
  const saved = [];
  render(h(Fixture, { disabled: true, onSubmit: (value) => saved.push(value) }));
  fireEvent.click(screen.getByText('Reset'));
  assert.equal(screen.getByLabelText('Email').disabled, true);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => assert.equal(saved.length, 1));
  assert.deepEqual(saved[0], {
    profile: { email: 'reset@example.com' },
    count: 0,
    visible: null,
    tags: [],
  });
});

test('Zod transforms preserve input controls and deliver output to submit', async () => {
  assert.equal(typeof Forms.useZodForm, 'function');
  const saved = [];
  function Transform() {
    const form = Forms.useZodForm(
      z.object({ name: z.string().transform((value) => value.length) }),
      { defaultValues: { name: 'Alice' } },
    );

    return h(
      'form',
      { onSubmit: form.handleSubmit((value) => saved.push(value)) },
      h(Forms.ControlledField, {
        control: form.control,
        config: { kind: 'text', label: 'Name', name: 'name' },
      }),
      h('button', { type: 'submit' }, 'Submit'),
    );
  }
  render(h(Transform));
  fireEvent.click(screen.getByText('Submit'));
  await waitFor(() => assert.deepEqual(saved, [{ name: 5 }]));
  assert.equal(screen.getByLabelText('Name').value, 'Alice');
});

test('external JSON is strictly parsed and allowlisted without executable metadata', () => {
  assert.equal(typeof Forms.parseFormFields, 'function');
  assert.deepEqual(
    Forms.parseFormFields(
      JSON.parse(JSON.stringify(fields)),
      fields.map((field) => field.name),
    ),
    fields,
  );
  const invalid = [
    [{ ...fields[0], name: '__proto__.polluted' }],
    [{ ...fields[0], name: 'profile.constructor.name' }],
    [{ ...fields[0], name: 'unknown' }],
    [fields[0], fields[0]],
    [{ ...fields[0], kind: 'script' }],
    [{ ...fields[0], onChange: 'alert(1)' }],
    [
      {
        ...fields[2],
        options: [
          { label: 'First', value: true },
          { label: 'Second', value: true },
        ],
      },
    ],
    [{ ...fields[0], name: 'profile..email' }],
  ];
  for (const input of invalid)
    assert.throws(() =>
      Forms.parseFormFields(
        input,
        fields.map((field) => field.name),
      ),
    );
});

test('number drafts, typed options and multi-selection retain falsy values', async () => {
  const saved = [];
  render(h(Fixture, { onSubmit: (value) => saved.push(value) }));
  fireEvent.click(screen.getByText('Reset'));
  const count = screen.getByLabelText('Count');
  fireEvent.change(count, { target: { value: '1e' } });
  assert.equal(count.value, '1e');
  fireEvent.blur(count);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => assert.equal(count.getAttribute('aria-invalid'), 'true'));
  assert.equal(saved.length, 0);
  fireEvent.change(count, { target: { value: '0' } });
  fireEvent.focus(screen.getByRole('combobox', { name: 'Visibility' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Visibility' }), {
    target: { value: 'Hidden' },
  });
  fireEvent.click(screen.getByRole('option', { name: 'Hidden' }));
  const tags = screen.getByRole('combobox', { name: 'Tags' });
  for (const label of ['Design', 'API']) {
    fireEvent.change(tags, { target: { value: label } });
    fireEvent.click(screen.getByRole('option', { name: label }));
  }
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => assert.equal(saved.length, 1));
  assert.equal(saved[0].count, 0);
  assert.equal(saved[0].visible, false);
  assert.deepEqual(saved[0].tags, ['design', 'api']);
});

test('custom controls preserve nested errors, clearing and checkbox false', async () => {
  const saved = [];
  function Custom() {
    const form = Forms.useZodForm(
      z.object({ custom: z.object({ note: z.string().nullable(), check: z.boolean() }) }),
      { defaultValues: { custom: { check: false, note: 'Draft' } } },
    );
    const config = [
      {
        kind: 'custom',
        name: 'custom.note',
        label: 'Note',
        clearable: true,
        definition: { key: 'note', name: 'Note', type: 'text', required: false, options: [] },
      },
      { kind: 'checkbox', label: 'Approved', name: 'custom.check' },
    ];

    return h(
      'form',
      { onSubmit: form.handleSubmit((value) => saved.push(value)) },
      h(Forms.FormFields, { control: form.control, fields: config }),
      h('button', { type: 'submit' }, 'Save custom'),
    );
  }
  render(h(Custom));
  const note = screen.getByLabelText('Note');
  assert.equal(note.name, 'custom.note');
  fireEvent.click(screen.getByLabelText('Clear Note'));
  assert.ok(globalThis.document.activeElement === note);
  assert.equal(note.value, '');
  fireEvent.click(screen.getByText('Save custom'));
  await waitFor(() => assert.deepEqual(saved, [{ custom: { check: false, note: null } }]));
});

test('ordinary checkboxes honor optional labels and all widgets expose hints', () => {
  function Hints() {
    const form = Forms.useZodForm(z.object({ check: z.boolean(), count: z.number() }), {
      defaultValues: { check: false, count: 0 },
    });

    return h(Forms.FormFields, {
      control: form.control,
      fields: [
        { hint: 'Optional notification', kind: 'checkbox', label: 'Notify me', name: 'check' },
        { hint: 'Enter hours', kind: 'number', label: 'Estimate', name: 'count' },
      ],
    });
  }
  render(h(Hints));
  const check = screen.getByRole('checkbox', { name: 'Notify me' });
  assert.equal(check.getAttribute('aria-required'), 'false');
  assert.equal(
    globalThis.document.getElementById(check.getAttribute('aria-describedby')).textContent,
    'Optional notification',
  );
  const estimate = screen.getByLabelText('Estimate');
  assert.equal(
    globalThis.document.getElementById(estimate.getAttribute('aria-describedby')).textContent,
    'Enter hours',
  );
});

test('custom JSON definitions reject duplicate IDs and options on non-select fields', () => {
  const option = { color: '#334455', id: '20000000-0000-4000-8000-000000000501', label: 'Design' };
  const config = {
    kind: 'custom',
    name: 'team',
    label: 'Team',
    definition: {
      key: 'team',
      name: 'Team',
      required: false,
      type: 'single_select',
      options: [option, option],
    },
  };
  assert.throws(() => Forms.parseFormFields([config], ['team']));
  assert.throws(() =>
    Forms.parseFormFields(
      [{ ...config, definition: { ...config.definition, type: 'text', options: [option] } }],
      ['team'],
    ),
  );
});

test('domain field adapter emits only serializable presentation properties', () => {
  assert.equal(typeof Forms.customFieldConfig, 'function');
  const field = {
    id: 'not-presentation',
    workspaceId: 'not-presentation',
    key: 'effort',
    name: 'Effort',
    type: 'number',
    required: false,
    options: [],
    isInherited: true,
  };
  const config = Forms.customFieldConfig('customFields.effort', field);
  assert.deepEqual(config, {
    kind: 'custom',
    name: 'customFields.effort',
    label: 'Effort',
    definition: { key: 'effort', name: 'Effort', type: 'number', required: false, options: [] },
  });
  assert.deepEqual(Forms.parseFormFields([config], ['customFields.effort']), [config]);
});

test('generic select descriptors retain large workspace member lists', () => {
  const options = Array.from({ length: 5100 }, (_, index) => ({
    label: `Member ${index}`,
    value: `member-${index}`,
  }));
  const fields = [{ kind: 'multi_select', name: 'assigneeIds', label: 'Assignees', options }];
  assert.equal(Forms.parseFormFields(fields, ['assigneeIds'])[0].options.length, 5100);
});

test('datetime controls preserve milliseconds and clear to null', async () => {
  const submissions = [];
  function DatetimeForm() {
    const form = Forms.useZodForm(z.object({ due: z.string().nullable() }), {
      defaultValues: { due: '2026-06-10T12:45:30.123' },
    });

    return h(
      'form',
      { onSubmit: form.handleSubmit((value) => submissions.push(value)) },
      h(Forms.FormFields, {
        control: form.control,
        fields: [{ emptyValue: 'null', kind: 'datetime-local', label: 'Due time', name: 'due' }],
      }),
      h('button', { type: 'submit' }, 'Save time'),
    );
  }
  render(h(DatetimeForm));
  const input = screen.getByLabelText('Due time');
  assert.equal(input.type, 'datetime-local');
  assert.equal(input.step, '0.001');
  assert.equal(input.value, '2026-06-10T12:45:30.123');
  fireEvent.click(screen.getByRole('button', { name: 'Save time' }));
  await waitFor(() => assert.deepEqual(submissions[0], { due: '2026-06-10T12:45:30.123' }));
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save time' }));
  await waitFor(() => assert.deepEqual(submissions[1], { due: null }));
});
