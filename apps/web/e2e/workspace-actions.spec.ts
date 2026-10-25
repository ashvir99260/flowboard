import { expect, test } from '@playwright/test';

import { login } from './helpers';

test('workspace quick actions create a private invitation and the recipient can accept it', async ({
  page,
  browser,
}) => {
  await login(page);
  const actions = page.getByRole('navigation', { name: 'Workspace actions' });
  await actions.getByRole('button', { exact: true, name: 'New task' }).click();
  const destination = page.getByRole('dialog', { name: 'Create a task' });
  await destination
    .getByLabel(/^Destination list/)
    .selectOption({ label: 'Engineering / Delivery / Product backlog' });
  await destination.getByRole('button', { exact: true, name: 'Continue to task' }).click();
  const task = page.getByRole('dialog', { name: 'Task details' });
  await expect(task.getByLabel(/^Title/)).toBeVisible();
  await task.getByRole('button', { exact: true, name: 'Close task' }).click();

  await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
  await expect(page.getByRole('heading', { exact: true, name: 'Product backlog' })).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'New task' })).toHaveCount(1);
  await actions.getByRole('button', { exact: true, name: 'New task' }).click();
  await expect(task.getByLabel(/^Title/)).toBeVisible();
  await task.getByRole('button', { exact: true, name: 'Close task' }).click();

  await actions.getByRole('button', { exact: true, name: 'Invite' }).click();
  const invite = page.getByRole('dialog', { name: 'Invite to workspace' });
  await invite.getByLabel(/^Email address/).fill('not-an-email');
  await invite.getByRole('button', { exact: true, name: 'Create invitation link' }).click();
  await expect(invite.getByLabel(/^Email address/)).toBeFocused();
  await invite.getByLabel(/^Email address/).fill('dan@example.com');
  await invite.getByRole('button', { exact: true, name: 'Close invitation' }).click();
  await page
    .getByRole('dialog', { name: 'Discard invitation draft?' })
    .getByRole('button', { exact: true, name: 'Cancel' })
    .click();
  await expect(invite.getByLabel(/^Email address/)).toHaveValue('dan@example.com');
  await invite.getByRole('button', { exact: true, name: 'Create invitation link' }).click();
  await expect(
    invite.getByText('Invitation created. No email has been sent.', { exact: true }),
  ).toBeVisible();
  const link = await invite.getByLabel(/^Private invitation link/).inputValue();
  expect(new URL(link).search).toBe('');
  expect(new URL(link).hash).toMatch(/^#token=[A-Za-z0-9_-]{43}$/);

  const recipient = await browser.newContext({ baseURL: process.env.FLOWBOARD_E2E_URL });
  try {
    const receiver = await recipient.newPage();
    await receiver.goto(link);
    await expect(
      receiver.getByRole('link', { exact: true, name: 'Sign in in a new tab' }),
    ).toBeVisible();
    const signIn = await recipient.newPage();
    await signIn.goto('/login');
    await signIn.getByLabel(/^Email/).fill('dan@example.com');
    await signIn.getByLabel(/^Password/).fill('FlowboardDemo123!');
    await signIn.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await expect(signIn.getByRole('button', { name: /Other Tenant/ })).toBeVisible();
    await receiver.getByRole('button', { exact: true, name: 'I have signed in' }).click();
    await receiver.getByRole('button', { exact: true, name: 'Accept invitation' }).click();
    await expect(receiver.getByText('You joined Flowboard Demo.', { exact: true })).toBeVisible();
    expect(new URL(receiver.url()).hash).toBe('');
    await receiver.getByRole('link', { exact: true, name: 'Open workspace' }).click();
    const memberActions = receiver.getByRole('navigation', { name: 'Workspace actions' });
    await expect(
      memberActions.getByRole('button', { exact: true, name: 'New task' }),
    ).toBeVisible();
    await expect(memberActions.getByRole('button', { exact: true, name: 'Invite' })).toHaveCount(0);
    await expect(memberActions.getByRole('button', { exact: true, name: 'Settings' })).toHaveCount(
      0,
    );
  } finally {
    await recipient.close();
  }
});
