import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createProposal, generateProposalHtml } from '../src/lib/proposals';
import type { Language } from '../src/lib/locale';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
try {
  for (const language of ['en', 'ru'] as Language[]) {
    const sample = createProposal({ sample: true, language });
    sample.title = language === 'ru' ? 'Пример предложения — сайт кофейни Juniper' : 'Sample proposal — Juniper website';
    sample.notes = (language === 'ru'
      ? 'ДЕМОНСТРАЦИОННЫЙ ПРИМЕР — вымышленный клиент и проект.\n\n'
      : 'ILLUSTRATIVE SAMPLE — fictitious client and project, not an actual customer.\n\n') + sample.notes;
    const html = generateProposalHtml(sample, { watermark: true, language });
    await writeFile(`public/scopebook-example-${language}.html`, html);
    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({ path: `public/scopebook-example-${language}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close();
    console.log(`Generated ${language} sample HTML and PDF.`);
  }
} finally {
  await browser.close();
}
