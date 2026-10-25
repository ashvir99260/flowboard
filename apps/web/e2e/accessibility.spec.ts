import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { column, login, openBacklog } from './helpers';

test('seeded sibling boards, keyboard controls and responsive forms pass accessibility checks', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await openBacklog(page);
  const labels = () =>
    page
      .getByRole('region', { name: / column$/ })
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  await expect
    .poll(labels)
    .toEqual(['To do column', 'In progress column', 'Done column', 'Closed column']);
  await page.getByRole('button', { exact: true, name: 'Private launch' }).click();
  await expect
    .poll(labels)
    .toEqual([
      'To do column',
      'In review column',
      'Blocked column',
      'Done column',
      'Closed column',
    ]);
  await openBacklog(page);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ height: 1000, width });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
  const scan = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect((await scan()).violations).toEqual([]);
  const handle = column(page, 'To do')
    .getByRole('group', { name: /^Drag task/ })
    .first();
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/^Picked up/)).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(handle).toBeFocused();
  await page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await expect(drawer.getByLabel(/^Effort/)).toBeVisible();
  await page.setViewportSize({ height: 1000, width: 320 });
  expect((await scan()).violations).toEqual([]);
  await drawer.getByRole('button', { exact: true, name: 'Close task' }).click();
  await expect(
    page.getByRole('button', { exact: true, name: 'Open task: Build demo workflow 1' }),
  ).toBeFocused();
});
