import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { SocketEvents } from '@flowboard/contracts';
import { chromium, expect } from '@playwright/test';
import { io } from 'socket.io-client';

import { login, openBacklog } from '../e2e/helpers.ts';

import { startRealApp } from './common/real-app-fixture.mjs';

test('a delayed list subscription catches up a missed write without discarding a dirty draft', async (t) => {
  const browser = await chromium.launch();
  let observer;
  t.after(() => {
    observer?.disconnect();

    return browser.close();
  });
  const app = await startRealApp(t, { activityWorker: true, realtime: true });
  const page = await browser.newPage({ baseURL: app.origin });
  let release;
  let held;
  const subscription = new Promise((resolve) => {
    held = resolve;
  });
  await page.routeWebSocket(/\/socket\.io\//, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      if (String(message).includes(`"${SocketEvents.subscribe}"`)) {
        release = () => server.send(message);
        held();
      } else server.send(message);
    });
  });
  await login(page);
  await openBacklog(page);
  await subscription;
  await page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await drawer.getByLabel(/^Effort/).fill('8');

  const writer = await browser.newContext({ extraHTTPHeaders: { Origin: app.origin } });
  const session = await writer.request.post(`${app.origin}/api/v1/auth/login`, {
    data: { email: 'bob@example.com', password: 'FlowboardDemo123!' },
  });
  assert.equal(session.status(), 200);
  const token = (await session.json()).data.accessToken;
  observer = io(app.apiOrigin, {
    auth: { token },
    extraHeaders: { Origin: app.origin },
    transports: ['websocket'],
    autoConnect: false,
  });
  const connected = once(observer, 'connect');
  observer.connect();
  await connected;
  const listId = 'f1000000-0000-4000-8000-000000000221';
  assert.deepEqual(await observer.timeout(10000).emitWithAck(SocketEvents.subscribe, { listId }), {
    ok: true,
  });
  const event = once(observer, SocketEvents.invalidate);
  const taskUrl = `${app.origin}/api/v1/tasks/f1000000-0000-4000-8000-000000000700`;
  const headers = { Authorization: `Bearer ${token}` };
  const current = await (await writer.request.get(taskUrl, { headers })).json();
  const saved = await writer.request.patch(taskUrl, {
    headers,
    data: {
      customFields: { effort: 9 },
      expectedVersion: current.data.version,
      expectedConfigVersion: current.configVersion,
    },
  });
  assert.equal(saved.status(), 200);
  assert.equal((await event)[0].listId, listId);
  release();

  await expect(
    drawer.getByText('This task changed elsewhere. Your unsaved edits are preserved.', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('8');
  await expect(drawer.getByRole('button', { exact: true, name: 'Save changes' })).toBeDisabled();
  await drawer.getByRole('button', { exact: true, name: 'Reload latest task' }).click();
  await page
    .getByRole('dialog', { name: 'Discard unsaved changes?' })
    .getByRole('button', { exact: true, name: 'Discard and reload' })
    .click();
  await expect(drawer.getByLabel(/^Effort/)).toHaveValue('9');
});
