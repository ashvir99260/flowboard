import { expect, test } from '@playwright/test';

import { login, openBacklog } from './helpers';

test('containers open from the hierarchy into a right-hand panel and protect dirty edits', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await login(page);
  await openBacklog(page);
  await page.getByRole('link', { exact: true, name: 'Containers and access' }).click();
  await expect(page.getByRole('form', { name: 'Administration editor' })).toHaveCount(0);
  const tree = page.getByRole('region', { name: 'Container hierarchy' });
  await expect(tree.getByRole('button', { exact: true, name: 'Engineering' })).toBeVisible();
  await tree.getByRole('button', { name: 'Collapse Engineering' }).click();
  await expect(tree.getByRole('button', { exact: true, name: 'Delivery' })).toBeHidden();
  await tree.getByRole('button', { name: 'Expand Engineering' }).click();
  const row = tree.getByRole('button', { exact: true, name: 'Product backlog' });
  await row.click();
  const panel = page.getByRole('region', { name: 'Container details' });
  await expect(panel.getByLabel(/^Container name/)).toHaveValue('Product backlog');
  const grants = panel.getByRole('region', { name: 'Scrollable member grants' });
  await expect(grants).toHaveAttribute('tabindex', '0');
  expect(await grants.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const treeBox = await tree.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(panelBox!.x).toBeGreaterThanOrEqual(treeBox!.x + treeBox!.width);
  await page.screenshot({ path: testInfo.outputPath('containers-desktop.png'), fullPage: true });
  await panel.getByLabel(/^Container name/).fill('Unsaved panel draft');
  await panel.getByRole('button', { name: 'Close container details' }).click();
  const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await confirm.getByRole('button', { exact: true, name: 'Cancel' }).click();
  await expect(panel.getByLabel(/^Container name/)).toHaveValue('Unsaved panel draft');
  await panel.getByLabel(/^Container name/).press('Escape');
  await confirm.getByRole('button', { exact: true, name: 'Discard and continue' }).click();
  await expect(panel).toHaveCount(0);
  await expect(row).toBeFocused();
  await row.click();
  await tree.getByRole('button', { name: 'Collapse Engineering' }).click();
  await panel.getByRole('button', { name: 'Close container details' }).click();
  await expect(tree.getByRole('button', { name: 'Expand Engineering' })).toBeFocused();
  await page.getByRole('button', { exact: true, name: 'New container' }).click();
  await expect(page.getByRole('region', { name: 'New container' })).toBeVisible();
  await expect(page.getByLabel(/^Container name/)).toHaveValue('');
});

test('status and field rows open responsive panels with guarded closing and retained navigation', async ({
  page,
}, testInfo) => {
  await login(page);
  await openBacklog(page);
  for (const [section, item, field] of [
    ['Status', 'In progress', 'Status name'],
    ['Field', 'Effort', 'Field name'],
  ] as const) {
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.getByRole('link', { exact: true, name: `${section} settings` }).click();
    await expect(page.getByRole('form', { name: `${section} editor` })).toHaveCount(0);
    const row = page.getByRole('button', { exact: true, name: `Edit ${item}` });
    await row.click();
    const panel = page.getByRole('region', { name: `${section} details` });
    const input = panel.getByLabel(new RegExp(`^${field}`));
    await page.screenshot({
      path: testInfo.outputPath(`${section.toLowerCase()}-desktop.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await page.screenshot({
      path: testInfo.outputPath(`${section.toLowerCase()}-dark.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await input.fill('Keep this draft');
    await panel.getByRole('button', { name: `Close ${section.toLowerCase()} details` }).click();
    const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
    await confirm.getByRole('button', { exact: true, name: 'Cancel' }).click();
    await page.getByRole('button', { exact: true, name: 'Product backlog' }).click();
    await expect(panel).toBeHidden();
    await page.getByRole('link', { exact: true, name: `${section} settings` }).click();
    await expect(input).toHaveValue('Keep this draft');
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(input).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      if (width === 320)
        await page.screenshot({
          path: testInfo.outputPath(`${section.toLowerCase()}-mobile.png`),
          fullPage: true,
        });
    }
    await input.press('Escape');
    await confirm.getByRole('button', { exact: true, name: 'Discard changes' }).click();
    await expect(panel).toHaveCount(0);
    await expect(row).toBeFocused();
    await row.click();
    await input.fill(`Saved ${item}`);
    await panel.getByRole('button', { exact: true, name: `Save ${section.toLowerCase()}` }).click();
    await expect(
      page.getByRole('button', { exact: true, name: `Edit Saved ${item}` }),
    ).toBeFocused();
  }
});
