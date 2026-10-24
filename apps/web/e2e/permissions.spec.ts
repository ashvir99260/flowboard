import { expect, test } from '@playwright/test';

import { login, openBacklog } from './helpers';

test('same-browser sign out closes sockets and Bob cannot retain Alice private content', async ({
  page,
}) => {
  let sockets = 0;
  page.on('websocket', (socket) => {
    sockets++;
    socket.on('close', () => sockets--);
  });
  await login(page);
  await expect(page.getByRole('button', { exact: true, name: 'Private launch' })).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Private launch' }).click();
  await expect(page.getByRole('region', { exact: true, name: 'Task board' })).toBeVisible();
  const privateUrl = page.url();
  await expect.poll(() => sockets).toBeGreaterThan(0);
  await page.getByRole('button', { exact: true, name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Flowboard' })).toBeVisible();
  await expect.poll(() => sockets).toBe(0);
  await login(page, 'bob@example.com', false);
  await expect(page.getByRole('button', { exact: true, name: 'Private launch' })).toHaveCount(0);
  await expect(page.getByRole('button', { exact: true, name: 'Discovery' })).toHaveCount(0);
  await openBacklog(page);
  await expect.poll(() => sockets).toBeGreaterThan(0);
  await page.goto(privateUrl);
  await expect(page.getByText('Access denied', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { exact: true, name: 'Task board' })).toHaveCount(0);
});
