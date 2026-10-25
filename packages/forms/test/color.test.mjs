import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement as h } from 'react';
import { z } from 'zod';

import { FormFields, parseFormFields, useZodForm } from '../dist/index.js';

afterEach(cleanup);

function ColorForm({ disabled = false, nullable = true, onSubmit, onValueChange }) {
  const color = z.string().regex(/^#[\da-f]{6}$/i, 'Use a six-digit hex color');

  const form = useZodForm(z.object({ color: nullable ? color.nullable() : color }), {
    defaultValues: { color: '#334455' },
  });

  return h(
    'form',
    { noValidate: true, onSubmit: form.handleSubmit(onSubmit) },
    h(FormFields, {
      control: form.control,
      disabled,
      onValueChange,
      fields: [
        {
          kind: 'color',
          name: 'color',
          label: 'Status color',
          required: !nullable,
          clearable: nullable,
          clearLabel: 'Use inherited color',
        },
      ],
    }),
    h('button', { type: 'submit' }, 'Save'),
    h('button', { type: 'button', onClick: () => form.reset() }, 'Reset'),
  );
}

test('color picker and hex text synchronize, validate drafts and explicitly inherit null', async () => {
  const submissions = [];
  const changes = [];
  render(
    h(ColorForm, {
      onSubmit: (value) => submissions.push(value),
      onValueChange: (...args) => changes.push(args),
    }),
  );
  const text = screen.getByRole('textbox', { name: 'Status color' });
  const picker = screen.getByLabelText('Choose Status color');
  assert.equal(picker.type, 'color');
  assert.equal(picker.value, '#334455');

  fireEvent.change(picker, { target: { value: '#112233' } });
  assert.equal(text.value, '#112233');
  assert.deepEqual(changes.at(-1), ['color', '#112233']);
  fireEvent.change(text, { target: { value: '#aabbcc' } });
  assert.equal(picker.value, '#aabbcc');
  fireEvent.change(text, { target: { value: 'invalid' } });
  fireEvent.blur(text);
  await screen.findByText('Use a six-digit hex color');
  assert.equal(text.value, 'invalid');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(globalThis.document.activeElement === text));
  assert.equal(submissions.length, 0);

  fireEvent.click(screen.getByRole('button', { name: 'Use inherited color' }));
  assert.equal(text.value, '');
  assert.ok(globalThis.document.activeElement === text);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(submissions, [{ color: null }]));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  assert.equal(text.value, '#334455');
  assert.equal(picker.value, '#334455');
});

test('required colors reject clearing and disabled controls retain their submitted value', async () => {
  const submissions = [];
  const view = render(
    h(ColorForm, { nullable: false, onSubmit: (value) => submissions.push(value) }),
  );
  assert.equal(screen.queryByRole('button', { name: 'Use inherited color' }), null);
  const text = screen.getByRole('textbox', { name: /Status color/ });
  fireEvent.change(text, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.equal(text.getAttribute('aria-invalid'), 'true'));
  assert.equal(submissions.length, 0);
  view.unmount();

  render(h(ColorForm, { disabled: true, onSubmit: (value) => submissions.push(value) }));
  assert.equal(screen.getByRole('textbox', { name: 'Status color' }).disabled, true);
  assert.equal(screen.getByLabelText('Choose Status color').disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Use inherited color' }).disabled, true);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.deepEqual(submissions, [{ color: '#334455' }]));
});

test('color JSON uses the same strict allowlisted descriptor boundary', () => {
  const descriptor = { clearable: true, kind: 'color', label: 'Color', name: 'color' };
  assert.deepEqual(parseFormFields([descriptor], ['color']), [descriptor]);
  assert.throws(() => parseFormFields([{ ...descriptor, expression: 'unsafe' }], ['color']));
  assert.throws(() => parseFormFields([descriptor], ['other']));
});
