import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { parseBackup } from '../src/lib/proposals';

test('mocked Pro entitlements allow multiple proposals, clean exports, and lossless backup restore', async ({ page }) => {
  // This exercises the paid UI, not payment fulfilment. The server suite tests
  // Stripe payment verification and license activation independently.
  await page.route('**/api/billing/status', route => route.fulfill({
    json: { configured: true, pro: true, price: { amount: 29, currency: 'usd', type: 'one_time' } },
  }));
  page.on('dialog', dialog => void dialog.accept());
  await page.goto('/app?sample=1');
  await expect(page.locator('.tier-pill')).toHaveText('PRO');
  await page.getByRole('button', { name: 'Save proposal', exact: true }).click();
  await page.getByRole('button', { name: 'All proposals', exact: true }).click();
  await page.getByRole('button', { name: 'New proposal', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Beacon launch');
  await page.getByLabel('Company', { exact: true }).fill('Beacon');
  await page.getByRole('button', { name: 'Save proposal', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Proposal saved');
  await page.getByRole('tab', { name: 'Client preview' }).click();
  const preview = page.frameLocator('iframe[title="Client proposal preview"]');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText('Beacon launch');
  await expect(preview.locator('.watermark')).toHaveCount(0);
  await page.getByRole('button', { name: 'All proposals', exact: true }).click();
  await expect(page.locator('.proposal-row')).toHaveCount(2);

  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup', exact: true }).click();
  const download = await downloadEvent;
  const backupText = await readFile((await download.path())!, 'utf8');
  const backup = parseBackup(backupText);
  expect(backup).toHaveLength(2);
  expect(backup.map(proposal => proposal.title).sort()).toEqual(['A fresh home for Juniper', 'Beacon launch']);
  expect(backup.find(proposal => proposal.title === 'A fresh home for Juniper')?.items).toHaveLength(3);

  await page.getByRole('button', { name: 'Delete A fresh home for Juniper', exact: true }).click();
  await expect(page.locator('.proposal-row')).toHaveCount(1);
  await page.getByLabel('Import workspace backup', { exact: true }).setInputFiles({
    name: 'scopebook-backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText),
  });
  await expect(page.getByRole('status')).toContainText('2 proposals imported');
  await expect(page.locator('.proposal-row')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.proposal-row')).toHaveCount(2);
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('scopebook.proposals.v1')!));
  expect(restored.proposals).toEqual(expect.arrayContaining(backup));
});

test('free preview and downloaded client document render malicious content as inert text', async ({ page, context }) => {
  const maliciousTitle = '<img src=x onerror="alert(1)">';
  const maliciousNotes = '</style><script>window.__scopebookInjected = true; alert(2)</script>';
  let dialogs = 0;
  page.on('dialog', dialog => { dialogs += 1; void dialog.dismiss(); });
  await page.goto('/app?sample=1');
  await page.getByLabel('Project name', { exact: true }).fill(maliciousTitle);
  await page.getByRole('tab', { name: /Scope & terms/ }).click();
  await page.getByRole('textbox', { name: 'Additional terms & notes', exact: true }).fill(maliciousNotes);
  await page.getByRole('textbox', { name: /^What’s outside the scope/ }).fill('<iframe src="javascript:alert(3)"></iframe>');
  await page.getByRole('tab', { name: 'Client preview' }).click();
  const preview = page.frameLocator('iframe[title="Client proposal preview"]');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText(maliciousTitle);
  await expect(preview.locator('body')).toContainText(maliciousNotes);
  await expect(preview.locator('script, img, iframe')).toHaveCount(0);

  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download HTML', exact: true }).click();
  const documentText = await readFile((await (await downloadEvent).path())!, 'utf8');
  expect(documentText).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  expect(documentText).not.toContain('<script>');
  const exportedPage = await context.newPage();
  exportedPage.on('dialog', dialog => { dialogs += 1; void dialog.dismiss(); });
  await exportedPage.setContent(documentText);
  await expect(exportedPage.getByRole('heading', { level: 1 })).toHaveText(maliciousTitle);
  await expect(exportedPage.locator('.watermark')).toContainText('Scopebook');
  await expect(exportedPage.locator('script, img, iframe')).toHaveCount(0);
  expect(await exportedPage.evaluate(() => '__scopebookInjected' in window)).toBe(false);
  expect(dialogs).toBe(0);
});

test('browser storage quota failure keeps an unsaved proposal editable and reports the failed save', async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'scopebook.proposals.v1') throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/app?sample=1');
  await page.getByLabel('Project name', { exact: true }).fill('Keep this unsaved draft');
  await page.getByRole('button', { name: 'Save proposal', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save');
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Keep this unsaved draft');
  await expect(page.locator('.editor-header')).toContainText('Unsaved changes');
  expect(await page.evaluate(() => localStorage.getItem('scopebook.proposals.v1'))).toBeNull();
  await page.getByRole('tab', { name: 'Client preview' }).click();
  await expect(page.frameLocator('iframe[title="Client proposal preview"]').getByRole('heading', { level: 1 })).toHaveText('Keep this unsaved draft');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download HTML', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('keep-this-unsaved-draft.html');
});
