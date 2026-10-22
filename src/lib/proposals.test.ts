import { describe, expect, it } from 'vitest';
import {
  calculateChangeOrder, calculateProposal, createBlankProposal, createProposal,
  generateProposalHtml, parseBackup, serializeBackup, validateProposal,
} from './proposals';

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
