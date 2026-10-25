import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';

import { chromium } from '@playwright/test';

import { startAppApi } from './common/app-api-fixture.mjs';
import { startWeb } from './common/proxy-fixture.mjs';

test(
  'login retains failed values, restores its cookie session and logs out without stored credentials',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/login`);
    await page.getByRole('heading', { name: 'Sign in to Flowboard' }).waitFor();
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('wrong-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('alert').getByText('Invalid email or password').waitFor();
    assert.equal(await page.getByLabel(/^Email/).inputValue(), 'alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Choose a workspace' }).waitFor();
    await page.getByRole('button', { name: /Engineering/ }).waitFor();
    const stored = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        cookies: document.cookie,
      }),
    );
    assert.ok(!stored.includes('fixture-access'));
    assert.ok(!stored.includes('browser-test-password'));
    assert.ok(!stored.includes('flowboard_refresh'));
    await page.reload();
    await page.getByRole('heading', { name: 'Choose a workspace' }).waitFor();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Sign in to Flowboard' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Engineering/ }).count(), 0);
  },
);

test(
  'paginated navigation follows URL selection and removes private data when another user signs in',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const login = async (email, visit = true) => {
      if (visit) await page.goto(`${origin}/login`);

      await page.getByRole('heading', { name: 'Sign in to Flowboard' }).waitFor();
      await page.getByLabel(/^Email/).fill(email);
      await page.getByLabel(/^Password/).fill('browser-test-password');
      await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await page.getByRole('button', { name: /Engineering/ }).click();
      await page.getByRole('navigation', { name: 'Workspace navigation' }).waitFor();
    };
    page.on('pageerror', (error) => t.diagnostic(error.message));
    await login('alice@example.test');
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    await page.getByRole('heading', { exact: true, name: 'Public list' }).waitFor();
    await mkdir(new URL('../../../.ai-local/p0803/', import.meta.url), { recursive: true });
    await page.screenshot({
      path: new URL('../../../.ai-local/p0803/desktop.png', import.meta.url).pathname,
      fullPage: true,
    });
    await page.getByRole('button', { exact: true, name: 'Private list' }).click();
    await page.getByRole('heading', { exact: true, name: 'Private list' }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { exact: true, name: 'Public list' }).waitFor();
    await page.getByRole('button', { name: /^Account menu for / }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await login('bob@example.test', false);
    assert.equal(await page.getByRole('button', { exact: true, name: 'Private list' }).count(), 0);
    await page.goto(`${origin}/w/${api.workspace.id}/lists/${api.privateList.id}`);
    await page.getByRole('alert').getByText('Access denied').waitFor();
    assert.equal(await page.getByRole('heading', { exact: true, name: 'Private list' }).count(), 0);
    api.controls.wrongNodeId = api.privateList.id;
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    await page.getByRole('alert', { name: 'List unavailable' }).waitFor();
    assert.equal(await page.getByRole('heading', { exact: true, name: 'Public list' }).count(), 0);
  },
);

test(
  'signup validates input and an expired cookie removes all authenticated content',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/signup`);
    await page.getByRole('button', { name: 'Create account' }).click();
    assert.equal(api.requests.filter((request) => request.path === '/v1/auth/signup').length, 0);
    await page.getByLabel(/^Your name/).fill('Caroline');
    await page.getByLabel(/^Email/).fill('caroline@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByLabel(/^Workspace name/).fill('Design studio');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('button', { name: /Design studio/ }).waitFor();
    await page.getByRole('button', { name: /Design studio/ }).click();
    await page.getByRole('button', { exact: true, name: 'Public list' }).waitFor();
    api.cookies.clear();
    api.access.clear();
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    await page.getByRole('heading', { name: 'Sign in to Flowboard' }).waitFor();
    assert.equal(await page.getByRole('navigation').count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Public list' }).count(), 0);
  },
);

test(
  'stale and malformed tree pages restart once and expose a bounded retry state',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    api.controls.treeStaleRemaining = 1;
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    await page.getByRole('button', { exact: true, name: 'Public list' }).waitFor();
    assert.equal(api.requests.filter((request) => request.path === '/v1/tree').length, 4);
    api.controls.treeAlwaysStale = true;
    await page.reload();
    await page.getByRole('button', { name: 'Retry navigation' }).waitFor();
    const bounded = api.requests.filter((request) => request.path === '/v1/tree').length;
    assert.equal(bounded, 8);
    api.controls.treeAlwaysStale = false;
    api.controls.malformedTree = true;
    await page.reload();
    await page.getByRole('button', { name: 'Retry navigation' }).waitFor();
    assert.equal(api.requests.filter((request) => request.path === '/v1/tree').length, bounded + 2);
    assert.equal(await page.getByRole('button', { exact: true, name: 'Public list' }).count(), 0);
    api.controls.malformedTree = false;
    await page.getByRole('button', { name: 'Retry navigation' }).click();
    await page.getByRole('button', { exact: true, name: 'Public list' }).waitFor();
  },
);

test(
  'workspace changes discard a delayed list response and mobile navigation supports keyboard controls',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email/).fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('browser-test-password');
    await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Engineering/ }).click();
    let release;
    api.controls.nodeGate = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    await page.getByRole('button', { exact: true, name: 'Public list' }).click();
    await page.waitForURL(`**/lists/${api.publicList.id}`);
    await page.getByRole('link', { name: 'Switch workspace' }).click();
    await page.getByRole('button', { name: /Research/ }).click();
    await page.getByRole('button', { exact: true, name: 'Research plan' }).waitFor();
    release();
    api.controls.nodeGate = null;
    assert.equal(await page.getByRole('heading', { exact: true, name: 'Public list' }).count(), 0);
    assert.equal(await page.getByRole('button', { exact: true, name: 'Public list' }).count(), 0);
    await page.setViewportSize({ height: 800, width: 320 });
    await page.reload();
    const open = page.getByRole('button', { name: 'Open navigation' });
    await open.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Collapse Discovery' }).click();
    assert.equal(
      await page.getByRole('button', { exact: true, name: 'Research plan' }).isVisible(),
      false,
    );
    await page.getByRole('button', { name: 'Expand Discovery' }).click();
    await page.getByRole('button', { exact: true, name: 'Research plan' }).click();
    await page.getByRole('heading', { exact: true, name: 'Research plan' }).waitFor();
    await open.waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open navigation');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      if (width < 900) {
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await page.waitForFunction(
          () =>
            document
              .querySelector('nav[aria-label="Workspace navigation"]')
              ?.getBoundingClientRect().left >= 0,
        );
      }

      await mkdir(new URL('../../../.ai-local/p0803/', import.meta.url), { recursive: true });
      await page.screenshot({
        path: new URL(`../../../.ai-local/p0803/navigation-${width}.png`, import.meta.url).pathname,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      );
      if (width < 900) await page.getByRole('button', { name: 'Close navigation' }).click();
    }
  },
);

test(
  'a failed logout warning cannot survive a later successful login',
  { timeout: 120000 },
  async (t) => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const api = await startAppApi(t);
    const { origin } = await startWeb(t, api.origin);
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/login`);
    const signIn = async (email) => {
      await page.getByLabel(/^Email/).fill(email);
      await page.getByLabel(/^Password/).fill('browser-test-password');
      await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
      await page.getByRole('heading', { name: 'Choose a workspace' }).waitFor();
    };
    await signIn('alice@example.test');
    api.controls.logoutFailures = 1;
    await page.getByRole('button', { exact: true, name: 'Sign out' }).click();
    await page.getByRole('button', { name: 'Retry sign out' }).waitFor();
    await signIn('bob@example.test');
    assert.equal(await page.getByRole('button', { name: 'Retry sign out' }).count(), 0);
  },
);

test('signing out in another tab clears the visible workspace', { timeout: 120000 }, async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const api = await startAppApi(t);
  const { origin } = await startWeb(t, api.origin);
  const context = await browser.newContext();
  const first = await context.newPage();
  first.setDefaultTimeout(10000);
  await first.goto(`${origin}/login`);
  await first.getByLabel(/^Email/).fill('alice@example.test');
  await first.getByLabel(/^Password/).fill('browser-test-password');
  await first.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await first.getByRole('button', { name: /Engineering/ }).click();
  await first.getByRole('button', { exact: true, name: 'Private list' }).click();
  await first.getByRole('heading', { exact: true, name: 'Private list' }).waitFor();
  const second = await context.newPage();
  second.setDefaultTimeout(10000);
  await second.goto(`${origin}/workspaces`);
  await second.getByRole('button', { exact: true, name: 'Sign out' }).click();
  await first.getByRole('heading', { name: 'Sign in to Flowboard' }).waitFor();
  assert.equal(await first.getByRole('navigation').count(), 0);
  assert.equal(await first.getByRole('heading', { exact: true, name: 'Private list' }).count(), 0);
});
