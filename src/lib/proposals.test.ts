import { describe, expect, it } from 'vitest';
import {
  calculateChangeOrder, calculateProposal, createBlankProposal, createProposal,
  formatMoney, generateProposalHtml, parseBackup, serializeBackup, validateProposal,
} from './proposals';
import { domainErrorRu } from '../locales/domain';

describe('proposal economics', () => {
  it('counts contingency as capacity, keeps tax out of profit, and splits gross payments', () => {
    const proposal = createProposal({ sample: true });
    proposal.taxPercent = 10;
    const totals = calculateProposal(proposal);
    expect(totals).toEqual({
      fee: 4800, totalHours: 40, bufferedHours: 48, effectiveRate: 100,
      capacityCost: 3120, profit: 1680, marginPercent: 35,
      tax: 480, total: 5280, deposit: 2640, balance: 2640,
    });
  });

  it('handles an empty estimate without NaN or Infinity', () => {
    const proposal = createBlankProposal();
    proposal.items = [];
    expect(Object.values(calculateProposal(proposal)).every(value => value === 0)).toBe(true);
  });

  it('shows losses instead of hiding an unprofitable project', () => {
    const proposal = createBlankProposal();
    proposal.items = [{ id: 'line-1', name: 'Underquoted work', description: '', hours: 10, rate: 20 }];
    proposal.hourlyRate = 100;
    proposal.bufferPercent = 0;
    expect(calculateProposal(proposal).profit).toBe(-800);
    expect(calculateProposal(proposal).marginPercent).toBe(-400);
  });

  it('rounds line amounts and percentage payments to cents', () => {
    const proposal = createBlankProposal();
    proposal.items = [{ id: 'fractional', name: 'Work', description: '', hours: 1.25, rate: 99.99 }];
    proposal.depositPercent = 33;
    proposal.taxPercent = 7.5;
    const totals = calculateProposal(proposal);
    expect(totals.fee).toBe(124.99);
    expect(totals.tax).toBe(9.37);
    expect(totals.deposit).toBe(44.34);
    expect(totals.deposit + totals.balance).toBeCloseTo(totals.total, 2);
  });

  it('prices extra work with its own contingency', () => {
    expect(calculateChangeOrder(5, 120, 20)).toEqual({ hours: 5, bufferedHours: 6, fee: 720 });
    expect(calculateChangeOrder(-4, Number.NaN)).toEqual({ hours: 0, bufferedHours: 0, fee: 0 });
  });
});

describe('backup validation', () => {
  it('roundtrips multiple proposals and preserves proposal IDs', () => {
    const originals = [createProposal({ sample: true }), createBlankProposal()];
    expect(parseBackup(serializeBackup(originals))).toEqual(originals);
  });

  it('rejects malformed JSON and foreign backup formats', () => {
    expect(() => parseBackup('{broken')).toThrow('not valid JSON');
    expect(() => parseBackup('{"app":"Other","version":1,"proposals":[]}')).toThrow('Unsupported backup');
    expect(() => parseBackup('{"app":"Scopebook","version":2,"proposals":[]}')).toThrow('Unsupported backup');
  });

  it('rejects non-finite and out-of-range amounts and unsupported currencies', () => {
    const proposal = createBlankProposal();
    expect(() => validateProposal({ ...proposal, hourlyRate: Number.NaN })).toThrow('Target hourly rate');
    expect(() => validateProposal({ ...proposal, depositPercent: 101 })).toThrow('Deposit');
    expect(() => validateProposal({ ...proposal, currency: 'XYZ' })).toThrow('Unsupported');
    expect(() => validateProposal({ ...proposal, validDays: 0 })).toThrow('Validity');
    expect(() => validateProposal({ ...proposal, items: [{ ...proposal.items[0], hours: -1 }] })).toThrow('Line hours');
  });

  it('rejects duplicate IDs and oversized structures', () => {
    const proposal = createBlankProposal();
    expect(() => parseBackup(JSON.stringify({ app: 'Scopebook', version: 1, proposals: [proposal, proposal] }))).toThrow('duplicate proposal IDs');
    expect(() => validateProposal({ ...proposal, items: [proposal.items[0], proposal.items[0]] })).toThrow('Line item IDs');
    expect(() => validateProposal({ ...proposal, included: Array(101).fill('scope') })).toThrow('at most 100');
    expect(() => validateProposal({ ...proposal, title: 'x'.repeat(301) })).toThrow('Title');
    expect(() => serializeBackup([proposal, proposal])).toThrow('duplicate proposal IDs');
  });

  it('strips unknown properties from imported proposals', () => {
    const validated = validateProposal({ ...createBlankProposal(), billingToken: 'not-a-real-secret', unexpected: true });
    expect(validated).not.toHaveProperty('billingToken');
    expect(validated).not.toHaveProperty('unexpected');
  });
});

describe('client proposal export', () => {
  it('renders incomplete drafts and the longest scope text allowed by the editor', () => {
    const proposal = createBlankProposal();
    proposal.title = '';
    proposal.clientName = '';
    proposal.clientCompany = '';
    proposal.studioName = '';
    proposal.timeline = '';
    proposal.items = [];
    proposal.included = ['a'.repeat(20000)];
    proposal.excluded = ['b'.repeat(20000)];
    const html = generateProposalHtml(proposal, { watermark: true });
    expect(html).toContain('<h1 class="title">Project proposal</h1>');
    expect(html).toContain('Your studio');
    expect(html).toContain('To be agreed before work begins');
    expect(html).toContain('$0');
    expect(html).toContain('a'.repeat(20000));
  });

  it('escapes user markup in every exported text area', () => {
    const proposal = createBlankProposal();
    proposal.title = '<script>alert("x")</script>';
    proposal.studioName = '<img src=x onerror=alert(1)>';
    proposal.included = ['<iframe src="javascript:alert(1)">'];
    proposal.notes = '</style><script>alert(2)</script>';
    const html = generateProposalHtml(proposal, { watermark: true });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src');
    expect(html).not.toContain('<iframe src');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Prepared with Scopebook');
  });

  it('contains client totals and scope but never exposes internal cost or margin', () => {
    const proposal = createProposal({ sample: true });
    const html = generateProposalHtml(proposal, { watermark: false });
    expect(html).toContain('$4,800');
    expect(html).toContain('$2,400');
    expect(html).toContain('Additional pages or revisions');
    expect(html).toContain('4 weeks');
    expect(html).not.toContain('Prepared with Scopebook');
    expect(html).not.toContain('capacityCost');
    expect(html).not.toContain('$3,120');
    expect(html).not.toContain('35%');
  });
});

describe('Russian proposal localization', () => {
  it('creates Russian defaults and a Russian sample without changing the English sample or the v1 backup schema', () => {
    const blank = createBlankProposal('ru');
    expect(blank.title).toBe('Предложение без названия');
    expect(blank.items[0].name).toBe('Работы по проекту');
    expect(blank.notes).toContain('Дополнительные работы оцениваются отдельно');
    const sample = createProposal({ sample: true, language: 'ru' });
    expect(sample.title).toBe('Новый сайт для Juniper');
    expect(sample.items[1].name).toBe('Дизайн сайта');
    expect(calculateProposal(sample)).toEqual(calculateProposal(createProposal({ sample: true })));
    expect(parseBackup(serializeBackup([sample, blank]))).toEqual([sample, blank]);
    expect(createProposal({ sample: true }).title).toBe('A fresh home for Juniper');
  });

  it('renders Russian document labels, regional dates, money and taxes without translating user content', () => {
    const proposal = createProposal({ sample: true, language: 'ru' });
    proposal.title = 'Client-approved original title';
    proposal.createdAt = '2026-10-22T12:00:00.000Z';
    proposal.taxPercent = 7.5;
    const html = generateProposalHtml(proposal, { watermark: true, language: 'ru' });
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('<h1 class="title">Client-approved original title</h1>');
    expect(html).toContain('Коммерческое предложение');
    expect(html).toContain('Что входит в объём работ');
    expect(html).toContain('Что не входит в объём работ');
    expect(html).toContain('22 октября 2026');
    expect(html).toContain('Налог (7,5');
    expect(html).toContain(formatMoney(4800, 'USD', 'ru'));
    expect(html).toContain('Подготовлено в Scopebook');
    expect(html).not.toContain('Your investment');
    expect(html).not.toContain('Feedback & revisions');
    expect(html).not.toContain(formatMoney(3120, 'USD', 'ru'));
    expect(html).not.toContain('35%');
  });

  it.each([[1, 'Включён 1 раунд', '1 день'], [2, 'Включено 2 раунда', '2 дня'], [5, 'Включено 5 раундов', '5 дней'], [21, 'Включён 21 раунд', '21 день']] as const)('uses Russian plural forms for %s rounds and validity days', (count, rounds, days) => {
    const proposal = createBlankProposal('ru');
    proposal.revisionRounds = count;
    proposal.validDays = count;
    const html = generateProposalHtml(proposal, { watermark: false, language: 'ru' });
    expect(html).toContain(rounds);
    expect(html).toContain(`действует ${days}`);
  });

  it('keeps markup inert in Russian exports and localizes known dynamic validation errors', () => {
    const proposal = createBlankProposal('ru');
    proposal.title = '<img src=x onerror="alert(1)">';
    proposal.included = ['</li><script>alert(2)</script>'];
    const html = generateProposalHtml(proposal, { watermark: false, language: 'ru' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(domainErrorRu('Line hours must be a number between 0 and 100000.')).toBe('Часы по позиции: введите число от 0 до 100000.');
    expect(domainErrorRu('Included scope 2 must be text of at most 20000 characters.')).toBe('Включённые работы, пункт 2: введите текст длиной не более 20000 символов.');
    expect(domainErrorRu('This file is not valid JSON. Choose a Scopebook backup.')).toContain('некорректный JSON');
    expect(domainErrorRu('An unknown external error')).toBeUndefined();
  });
});
