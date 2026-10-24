import test from 'node:test';

import { chromium, expect } from '@playwright/test';

import { startRealApp } from './common/real-app-fixture.mjs';

test(
  'independent clients refresh lists and preserve dirty drawers across remote updates and reconnect',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const app = await startRealApp(t, { activityWorker: true, realtime: true });
    const pages = [];
    let token;
    for (let i = 0; i < 2; i++) {
      const page = await browser.newPage();
      await page.goto(`${app.origin}/login`);
      await page.getByLabel(/^Email/).fill(i === 0 ? 'alice@example.com' : 'bob@example.com');
      await page.getByLabel(/^Password/).fill('FlowboardDemo123!');
      const login = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/auth/login'),
      );
      await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
      const response = await login;
      if (i === 0) token = (await response.json()).data.accessToken;

      await page.getByRole('button', { name: /Flowboard Demo/ }).click();
      await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
      await expect(
        page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }),
      ).toBeVisible();
      const signInToast = page.getByRole('status', { name: 'Notification: Signed in.' });
      if (await signInToast.count())
        await signInToast.getByRole('button', { name: 'Dismiss notification' }).click();

      pages.push(page);
    }
    const [editor, viewer] = pages;
    const open = (page, title) =>
      page.getByRole('button', { exact: true, name: `Open task: ${title}` }).click();
    const drawer = (page) => page.getByRole('dialog', { name: 'Task details' });
    const headers = { Authorization: `Bearer ${token}`, Origin: app.origin };
    const taskId = 'f1000000-0000-4000-8000-000000000700';
    await open(viewer, 'Build demo workflow 1');
    await drawer(viewer)
      .getByLabel(/^Title/)
      .fill('Keep my draft');
    let firstReadReady;
    let releaseFirstRead;
    let verificationReads = 0;
    const firstRead = new Promise((resolve) => {
      firstReadReady = resolve;
    });
    t.after(() => releaseFirstRead?.());
    const targetRoute = `**/api/v1/tasks/${taskId}`;
    await viewer.route(targetRoute, async (route) => {
      verificationReads++;
      if (verificationReads !== 1) {
        await route.continue();

        return;
      }

      const snapshot = await route.fetch();
      firstReadReady();
      await new Promise((resolve) => {
        releaseFirstRead = resolve;
      });
      await route.fulfill({ response: snapshot }).catch(() => undefined);
    });
    const otherUrl = `${app.origin}/api/v1/tasks/f1000000-0000-4000-8000-000000000704`;
    const other = await (await editor.request.get(otherUrl, { headers })).json();
    expect(
      (
        await editor.request.patch(otherUrl, {
          headers,
          data: {
            title: 'Unrelated update starts verification',
            expectedVersion: other.data.version,
            expectedConfigVersion: other.configVersion,
          },
        })
      ).status(),
    ).toBe(200);
    await firstRead;
    await expect(
      viewer.getByRole('status', { name: 'Notification: Tasks in this list were updated.' }),
    ).toBeVisible();
    await expect(
      editor.getByRole('status', { name: 'Notification: Tasks in this list were updated.' }),
    ).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Dismiss notification' }).click();
    await open(editor, 'Build demo workflow 1');
    await drawer(editor)
      .getByLabel(/^Title/)
      .fill('Remote saved title');
    await drawer(editor).getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(
      drawer(editor)
        .getByRole('status', { exact: true, name: '' })
        .filter({ hasText: 'Task saved.' }),
    ).toBeVisible();
    await expect(
      viewer.getByRole('status', { name: 'Notification: Tasks in this list were updated.' }),
    ).toHaveCount(1);
    await expect(
      editor.getByRole('status', { name: 'Notification: Tasks in this list were updated.' }),
    ).toHaveCount(0);
    await expect(
      drawer(viewer).getByText('This task changed elsewhere. Your unsaved edits are preserved.'),
    ).toBeVisible({ timeout: 15000 });
    await expect(drawer(viewer).getByLabel(/^Title/)).toHaveValue('Keep my draft');
    expect(verificationReads).toBeGreaterThan(1);
    releaseFirstRead();
    await viewer.unroute(targetRoute);
    await expect(
      drawer(viewer).getByRole('button', { exact: true, name: 'Save changes' }),
    ).toBeDisabled();
    await drawer(viewer).getByRole('button', { exact: true, name: 'Reload latest task' }).click();
    await viewer.getByRole('button', { exact: true, name: 'Discard and reload' }).click();
    await expect(drawer(viewer).getByLabel(/^Title/)).toHaveValue('Remote saved title');
    await drawer(viewer).getByRole('button', { exact: true, name: 'Close task' }).click();
    await expect(
      viewer.getByRole('button', { exact: true, name: 'Open task: Remote saved title' }),
    ).toBeVisible();
    await viewer.context().setOffline(true);
    await drawer(editor)
      .getByLabel(/^Title/)
      .fill('Updated while offline');
    await drawer(editor).getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(
      drawer(editor)
        .getByRole('status', { exact: true, name: '' })
        .filter({ hasText: 'Task saved.' }),
    ).toBeVisible();
    await viewer.context().setOffline(false);
    await expect(
      viewer.getByRole('button', { exact: true, name: 'Open task: Updated while offline' }),
    ).toBeVisible({ timeout: 15000 });
    const grantUrl = `${app.origin}/api/v1/nodes/f1000000-0000-4000-8000-000000000221/grants`;
    const current = await (
      await editor.request.get(`${app.origin}/api/v1/tasks/${taskId}`, { headers })
    ).json();
    const denied = await editor.request.put(grantUrl, {
      headers,
      data: {
        userId: 'f1000000-0000-4000-8000-000000000102',
        mode: 'deny',
        expectedConfigVersion: current.configVersion,
      },
    });
    expect(denied.status()).toBe(200);
    const deniedBody = await denied.json();
    await expect(viewer.getByText('Access denied', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    const allowed = await editor.request.delete(
      `${grantUrl}/f1000000-0000-4000-8000-000000000102`,
      {
        headers,
        data: { expectedConfigVersion: deniedBody.configVersion },
      },
    );
    expect(allowed.status()).toBe(204);
    await expect(
      viewer.getByRole('button', { exact: true, name: 'Open task: Updated while offline' }),
    ).toBeVisible({ timeout: 15000 });
    await drawer(editor).getByRole('button', { exact: true, name: 'Close task' }).click();
    await open(editor, 'Updated while offline');
    await drawer(editor)
      .getByLabel(/^Title/)
      .fill('Updated after access restored');
    await drawer(editor).getByRole('button', { exact: true, name: 'Save changes' }).click();
    await expect(
      viewer.getByRole('button', { exact: true, name: 'Open task: Updated after access restored' }),
    ).toBeVisible({ timeout: 15000 });
  },
);
