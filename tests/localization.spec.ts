import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { translate } from '../src/lib/locale';

test.use({ locale: 'ru-RU' });
const ru = (text: string, vars?: Record<string, string | number>) => translate('ru', text, vars);

test('Russian browser gets a complete landing page and language choice persists across routes and reloads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(ru('Good work.'));
  await expect(page.getByRole('button', { name: 'Русский', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.title()).toBe(ru('Scopebook — Better scope. Better business.'));
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good work.');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('link', { name: 'Build your first proposal', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Good work starts here.' })).toBeVisible();
  await page.getByRole('button', { name: 'Русский', exact: true }).click();
  await expect(page.getByRole('heading', { name: ru('Good work starts here') + '.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('switching languages preserves unsaved Cyrillic input and saved proposals', async ({ page }) => {
  await page.goto('/app?sample=1');
  const title = 'Сайт для кофейни «Маяк»';
  await page.getByRole('textbox', { name: ru('Project name'), exact: true }).fill(title);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue(title);
  await expect(page.locator('.editor-header')).toContainText('Unsaved changes');
  await page.getByRole('button', { name: 'Русский', exact: true }).click();
  await page.getByRole('button', { name: ru('Save proposal'), exact: true }).click();
  await expect(page.getByRole('status')).toContainText(ru('Proposal saved on this browser.'));
  await page.reload();
  await expect(page.getByRole('textbox', { name: ru('Project name'), exact: true })).toHaveValue(title);
  await page.getByRole('tab', { name: ru('Client preview') }).click();
  const preview = page.frameLocator('iframe.proposal-preview');
  await expect(preview.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(preview.getByRole('heading', { name: ru('Your investment'), exact: true })).toBeVisible();
  await expect(preview.locator('body')).not.toContainText('Feedback & revisions');
  await expect(preview.locator('body')).not.toContainText('Your investment');
  await expect(preview.locator('body')).not.toContainText(ru('Projected margin'));
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: ru('Download HTML'), exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('сайт-для-кофейни-маяк.html');
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('<html lang="ru">');
  expect(text).toContain('Сайт для кофейни');
  expect(text).not.toContain('Projected margin');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('Russian scope, extra work, payment notices and recovery errors remain localized', async ({ page }) => {
  await page.goto('/app?sample=1');
  await page.getByRole('button', { name: ru('Save proposal'), exact: true }).click();
  await page.getByRole('tab', { name: new RegExp(ru('Scope & terms')) }).click();
  await expect(page.getByRole('spinbutton', { name: ru('Included revision rounds'), exact: true })).toBeVisible();
  await page.getByRole('tab', { name: ru('Extra work') }).click();
  await page.getByRole('textbox', { name: ru('What’s changing?'), exact: true }).fill('Добавить раздел с сезонным меню.');
  await expect(page.getByRole('button', { name: ru('Print change order'), exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole('button', { name: ru('All proposals'), exact: true }).click();
  await page.getByRole('button', { name: ru('New proposal'), exact: true }).click();
  await page.getByRole('button', { name: ru('Save proposal'), exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(ru('Purchases are not open yet. The free workspace works now; no payment will be taken.'));
  await expect(page.getByRole('button', { name: ru('Payments coming soon'), exact: true })).toBeDisabled();
  const recovery = page.getByPlaceholder(ru('Paste your recovery key'));
  await recovery.fill('sbp_this_is_an_invalid_recovery_key_1234567890');
  await page.getByRole('button', { name: ru('Restore'), exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(ru('That recovery key is invalid or no longer active.'));
  await page.getByRole('button', { name: ru('Close dialog'), exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('Russian sample downloads are actual localized documents', async ({ page }) => {
  await page.goto('/');
  const event = page.waitForEvent('download');
  await page.getByRole('link', { name: ru('Download a sample PDF'), exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('scopebook-example-ru.pdf');
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  const html = await page.request.get('/scopebook-example-ru.html');
  expect(html.status()).toBe(200);
  expect(await html.text()).toContain('<html lang="ru">');
  expect(await html.text()).toContain(ru('Project proposal'));
});
