import { test, expect } from '@playwright/test';

test('landing calculator changes with the time estimate and free workspace opens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good work.');
  const margin = page.locator('.lp-calculator-margin strong');
  await expect(margin).toHaveText('35%');
  await page.locator('#lp-hours').fill('80');
  await expect(margin).toHaveText('-30%');
  await page.getByRole('link', { name: 'Build your first proposal' }).first().click();
  await expect(page.getByRole('heading', { name: 'Good work starts here.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('proposal edit, margin calculation, private client preview, save and reload', async ({ page }) => {
  await page.goto('/app?sample=1');
  await expect(page.locator('.profit-main > strong')).toHaveText('35%');
  await page.getByLabel('Project name', { exact: true }).fill('Juniper launch proposal');
  await page.getByLabel('Deliverable 1 hours', { exact: true }).fill('16');
  await expect(page.locator('.profit-main > strong')).toHaveText('35%');
  await page.getByLabel('Your target hourly pay', { exact: true }).fill('90');
  await expect(page.locator('.profit-main > strong')).toHaveText('10%');
  await page.getByRole('button', { name: 'Save proposal', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Proposal saved');
  await page.reload();
  await page.getByRole('button', { name: 'All proposals', exact: true }).click();
  await page.getByRole('button', { name: 'Juniper launch proposal Juniper Coffee', exact: true }).click();
  await expect(page.getByLabel('Your target hourly pay', { exact: true })).toHaveValue('90');
  await page.getByRole('tab', { name: 'Client preview' }).click();
  const preview = page.frameLocator('iframe[title="Client proposal preview"]');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText('Juniper launch proposal');
  await expect(preview.locator('body')).not.toContainText('Target hourly');
  await expect(preview.locator('body')).not.toContainText('Projected margin');
  await expect(preview.locator('.watermark')).toContainText('Scopebook');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download HTML' }).click();
  expect((await downloaded).suggestedFilename()).toBe('juniper-launch-proposal.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('free limit cannot silently overwrite proposal and billing clearly reports unavailability', async ({ page }) => {
  await page.goto('/app?sample=1');
  await page.getByRole('button', { name: 'Save proposal', exact: true }).click();
  await page.getByRole('button', { name: 'All proposals', exact: true }).click();
  await page.getByRole('button', { name: 'New proposal', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Second project');
  await page.getByRole('button', { name: 'Save proposal', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.getByRole('button', { name: 'Payments coming soon' })).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('no payment will be taken');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Second project');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('scopebook.proposals.v1') || '{}'));
  expect(stored.proposals).toHaveLength(1);
  expect(stored.proposals[0].title).not.toBe('Second project');
});

test('scope terms and extra work produce a usable separately priced change order', async ({ page }) => {
  await page.goto('/app?sample=1');
  await page.getByRole('tab', { name: /Scope & terms/ }).click();
  await page.getByLabel('Included revision rounds', { exact: true }).fill('3');
  await page.getByLabel('Sales tax (%)', { exact: true }).fill('10');
  await page.getByRole('tab', { name: 'Client preview' }).click();
  const preview = page.frameLocator('iframe[title="Client proposal preview"]');
  await expect(preview.locator('body')).toContainText('3 rounds of consolidated revisions');
  await expect(preview.locator('.sum.total')).toContainText('$5,280');
  await page.getByRole('tab', { name: 'Extra work' }).click();
  await page.getByLabel('What’s changing?', { exact: true }).fill('Add a five-page seasonal menu with supplied copy.');
  await page.getByLabel('Additional hours', { exact: true }).fill('5');
  await expect(page.locator('.change-fee strong')).toHaveText('$720');
  await page.getByRole('button', { name: 'Print change order' }).click();
  const change = page.frameLocator('iframe[title="Print proposal"]');
  await expect(change.getByRole('heading', { level: 1 })).toHaveText('Change order: Additional project work');
  await expect(change.locator('.sum.total')).toContainText('$792');
});

test('studio defaults persist and corrupted storage stays intact', async ({ page, isMobile }) => {
  await page.goto('/app');
  if (isMobile) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Studio settings', exact: true }).click();
  await page.getByLabel('Studio name', { exact: true }).fill('Fjord Studio');
  await page.getByLabel('Target hourly pay', { exact: true }).fill('85');
  await page.getByRole('button', { name: 'Save defaults' }).click();
  await page.reload();
  if (isMobile) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: /My proposals/ }).click();
  await page.getByRole('button', { name: 'New proposal', exact: true }).click();
  await expect(page.getByLabel('Your target hourly pay', { exact: true })).toHaveValue('85');
  await page.evaluate(() => localStorage.setItem('scopebook.proposals.v1', 'corrupted-data'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('kept the original data untouched');
  expect(await page.evaluate(() => localStorage.getItem('scopebook.proposals.v1'))).toBe('corrupted-data');
});
