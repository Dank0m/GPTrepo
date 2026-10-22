import { localeFor, translate, type Language } from './locale';

/** Proposal data stays in the browser. Backups contain client information, never billing credentials. */
export type Currency = 'USD' | 'EUR' | 'GBP';

export interface LineItem {
  id: string;
  name: string;
  description: string;
  hours: number;
  rate: number;
}

export interface Proposal {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  studioName: string;
  studioEmail: string;
  description: string;
  currency: Currency;
  hourlyRate: number;
  depositPercent: number;
  taxPercent: number;
  bufferPercent: number;
  items: LineItem[];
  included: string[];
  excluded: string[];
  revisionRounds: number;
  timeline: string;
  validDays: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalTotals {
  fee: number;
  totalHours: number;
  bufferedHours: number;
  effectiveRate: number;
  capacityCost: number;
  profit: number;
  marginPercent: number;
  deposit: number;
  tax: number;
  total: number;
  balance: number;
}

export interface ChangeOrder {
  hours: number;
  bufferedHours: number;
  fee: number;
}

export const SUPPORTED_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP'];
export const BACKUP_VERSION = 1;
const MAX_PROPOSALS = 500;
const MAX_BACKUP_BYTES = 5_000_000;

function id(): string {
  return globalThis.crypto.randomUUID();
}

/** Price arithmetic is rounded to cents at the line level, like an invoice. */
function cents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function percent(value: number, maximum = 100): number {
  return Math.min(maximum, nonnegative(value));
}

export function calculateProposal(proposal: Proposal): ProposalTotals {
  const fee = cents(proposal.items.reduce((sum, item) => sum + cents(nonnegative(item.hours) * nonnegative(item.rate)), 0));
  const totalHours = cents(proposal.items.reduce((sum, item) => sum + nonnegative(item.hours), 0));
  const bufferedHours = cents(totalHours * (1 + percent(proposal.bufferPercent, 300) / 100));
  const capacityCost = cents(bufferedHours * nonnegative(proposal.hourlyRate));
  const profit = cents(fee - capacityCost);
  const tax = cents(fee * percent(proposal.taxPercent) / 100);
  const total = cents(fee + tax);
  const deposit = cents(total * percent(proposal.depositPercent) / 100);
  return {
    fee,
    totalHours,
    bufferedHours,
    effectiveRate: bufferedHours > 0 ? cents(fee / bufferedHours) : 0,
    capacityCost,
    profit,
    marginPercent: fee > 0 ? cents(profit / fee * 100) : 0,
    tax,
    total,
    deposit,
    balance: cents(total - deposit),
  };
}

export function calculateChangeOrder(hours: number, rate: number, bufferPercent = 0): ChangeOrder {
  const safeHours = nonnegative(hours);
  const bufferedHours = cents(safeHours * (1 + percent(bufferPercent, 300) / 100));
  return { hours: safeHours, bufferedHours, fee: cents(bufferedHours * nonnegative(rate)) };
}

export function formatMoney(amount: number, currency: Currency = 'USD', language: Language = 'en'): string {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function currencyFormatter(currency: Currency = 'USD', language: Language = 'en'): Intl.NumberFormat {
  return new Intl.NumberFormat(localeFor(language), { style: 'currency', currency, maximumFractionDigits: 2 });
}

export function createBlankProposal(language: Language = 'en'): Proposal {
  const t = (key: string) => translate(language, key);
  const now = new Date().toISOString();
  return {
    id: id(), title: t('Untitled proposal'), clientName: '', clientEmail: '', clientCompany: '',
    studioName: t('Your studio'), studioEmail: '', description: '', currency: 'USD',
    hourlyRate: 65, depositPercent: 50, taxPercent: 0, bufferPercent: 20,
    items: [{ id: id(), name: t('Project work'), description: '', hours: 10, rate: 120 }],
    included: [t('One kickoff call'), t('Final files and handoff')],
    excluded: [t('Work outside the agreed scope'), t('Third-party subscriptions and licenses')],
    revisionRounds: 2, timeline: t('2–3 weeks from deposit and receipt of content'), validDays: 14,
    notes: t('Work begins after scope approval and receipt of the deposit. Additional work is quoted separately.'),
    createdAt: now, updatedAt: now,
  };
}

export function createProposal(options: { sample?: boolean; language?: Language } = {}): Proposal {
  const language = options.language || 'en';
  const t = (key: string) => translate(language, key);
  const proposal = createBlankProposal(language);
  if (!options.sample) return proposal;
  return {
    ...proposal,
    title: t('A fresh home for Juniper'),
    clientName: t('Alex Morgan'),
    clientEmail: 'alex@example.com',
    clientCompany: 'Juniper Coffee',
    studioName: 'Sunday Studio',
    studioEmail: 'hello@example.com',
    description: t('A thoughtful five-page website that brings Juniper’s story, seasonal menu, and neighborhood spirit online. Built to turn curious visitors into your next regulars.'),
    items: [
      { id: id(), name: t('Discovery & creative direction'), description: t('Kickoff workshop, content audit, and visual direction.'), hours: 8, rate: 120 },
      { id: id(), name: t('Website design'), description: t('Responsive designs for five pages, with two rounds of consolidated revisions.'), hours: 18, rate: 120 },
      { id: id(), name: t('Build & handoff'), description: t('Website implementation, responsive QA, and a recorded handoff.'), hours: 14, rate: 120 },
    ],
    included: [t('Five responsive website pages'), t('Two rounds of consolidated revisions'), t('Contact form and basic search metadata'), t('Recorded handoff and 14 days of bug fixes')],
    excluded: [t('Copywriting, photography, and brand identity'), t('E-commerce and custom integrations'), t('Hosting, domain, and ongoing maintenance'), t('Additional pages or revisions')],
    timeline: t('4 weeks from deposit and receipt of all content'),
    notes: t('A 50% deposit reserves your project. The remaining balance is due before launch. A revision round is one consolidated list of feedback. New requests are estimated and approved before work begins.'),
  };
}

export const SAMPLE_PROPOSAL: Proposal = createProposal({ sample: true });

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum = 500): string {
  if (typeof value !== 'string' || value.length > maximum) throw new Error(`${label} must be text of at most ${maximum} characters.`);
  return value;
}

function identifier(value: unknown, label: string): string {
  const result = text(value, label, 100);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(result)) throw new Error(`${label} is not a valid identifier.`);
  return result;
}

function number(value: unknown, label: string, maximum: number, minimum = 0, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be ${integer ? 'a whole number' : 'a number'} between ${minimum} and ${maximum}.`);
  }
  return value;
}

function date(value: unknown, label: string): string {
  const result = text(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error(`${label} must be a valid ISO date.`);
  return result;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${label} must be a list of at most 100 entries.`);
  // The editor accepts up to 20,000 characters per scope field. A single long
  // paragraph must remain a valid draft, including change-order descriptions.
  return value.map((entry, i) => text(entry, `${label} ${i + 1}`, 20000));
}

/** Returns a clean copy of the allowed schema; unknown properties never enter app state. */
export function validateProposal(value: unknown): Proposal {
  const p = object(value, 'Proposal');
  if (!SUPPORTED_CURRENCIES.includes(p.currency as Currency)) throw new Error('Unsupported proposal currency. Use USD, EUR, or GBP.');
  if (!Array.isArray(p.items) || p.items.length > 100) throw new Error('Proposal items must be a list of at most 100 entries.');
  const itemIds = new Set<string>();
  const items = p.items.map((value, index) => {
    const i = object(value, `Line ${index + 1}`);
    const itemId = identifier(i.id, 'Line ID');
    if (itemIds.has(itemId)) throw new Error('Line item IDs must be unique.');
    itemIds.add(itemId);
    return {
      id: itemId,
      name: text(i.name, 'Line name', 300),
      description: text(i.description, 'Line description', 3000),
      hours: number(i.hours, 'Line hours', 100000),
      rate: number(i.rate, 'Line rate', 1000000),
    };
  });
  return {
    id: identifier(p.id, 'Proposal ID'),
    title: text(p.title, 'Title', 300),
    clientName: text(p.clientName, 'Client name', 300),
    clientEmail: text(p.clientEmail, 'Client email', 320),
    clientCompany: text(p.clientCompany, 'Client company', 300),
    studioName: text(p.studioName, 'Studio name', 300),
    studioEmail: text(p.studioEmail, 'Studio email', 320),
    description: text(p.description, 'Description', 10000),
    currency: p.currency as Currency,
    hourlyRate: number(p.hourlyRate, 'Target hourly rate', 1000000),
    depositPercent: number(p.depositPercent, 'Deposit', 100),
    taxPercent: number(p.taxPercent, 'Tax', 100),
    bufferPercent: number(p.bufferPercent, 'Time buffer', 300),
    revisionRounds: number(p.revisionRounds, 'Revision rounds', 100, 0, true),
    validDays: number(p.validDays, 'Validity period', 365, 1, true),
    timeline: text(p.timeline, 'Timeline', 2000),
    notes: text(p.notes, 'Notes', 10000),
    included: strings(p.included, 'Included scope'),
    excluded: strings(p.excluded, 'Excluded scope'),
    items,
    createdAt: date(p.createdAt, 'Created date'),
    updatedAt: date(p.updatedAt, 'Updated date'),
  };
}

export function serializeBackup(proposals: Proposal[]): string {
  if (proposals.length > MAX_PROPOSALS) throw new Error(`A backup can contain at most ${MAX_PROPOSALS} proposals.`);
  const validated = proposals.map(validateProposal);
  if (new Set(validated.map(p => p.id)).size !== validated.length) throw new Error('Backup contains duplicate proposal IDs.');
  const result = JSON.stringify({ app: 'Scopebook', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), proposals: validated }, null, 2);
  if (new TextEncoder().encode(result).byteLength > MAX_BACKUP_BYTES) throw new Error('This backup is too large. The limit is 5 MB.');
  return result;
}

export function parseBackup(input: string): Proposal[] {
  if (input.length > MAX_BACKUP_BYTES || new TextEncoder().encode(input).byteLength > MAX_BACKUP_BYTES) throw new Error('This backup is too large. The limit is 5 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { throw new Error('This file is not valid JSON. Choose a Scopebook backup.'); }
  const backup = object(parsed, 'Backup');
  if (backup.app !== 'Scopebook' || backup.version !== BACKUP_VERSION) throw new Error('Unsupported backup. Choose a Scopebook version 1 backup.');
  if (!Array.isArray(backup.proposals) || backup.proposals.length > MAX_PROPOSALS) throw new Error(`Backup must contain a list of at most ${MAX_PROPOSALS} proposals.`);
  const proposals = backup.proposals.map(validateProposal);
  const ids = new Set(proposals.map(p => p.id));
  if (ids.size !== proposals.length) throw new Error('Backup contains duplicate proposal IDs.');
  return proposals;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

/** Standalone printable document. Internal costs and margin are intentionally excluded. */
export function generateProposalHtml(proposal: Proposal, options: { watermark: boolean; language?: Language }): string {
  const p = validateProposal(proposal);
  const totals = calculateProposal(p);
  const esc = escapeHtml;
  const language = options.language || 'en';
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const label = (key: string, vars?: Record<string, string | number>) => esc(t(key, vars));
  const money = (value: number) => esc(formatMoney(value, p.currency, language));
  const percentText = (value: number) => new Intl.NumberFormat(localeFor(language), { style: 'percent', maximumFractionDigits: 2 }).format(value / 100);
  const russianPlural = (count: number, forms: [string, string, string]) => { const plural = new Intl.PluralRules('ru-RU').select(count); return forms[plural === 'one' ? 0 : plural === 'few' ? 1 : 2]; };
  const revisions = language === 'ru'
    ? `${new Intl.PluralRules('ru-RU').select(p.revisionRounds) === 'one' ? 'Включён' : 'Включено'} ${p.revisionRounds} ${russianPlural(p.revisionRounds, ['раунд', 'раунда', 'раундов'])} правок по сводному списку замечаний. Дополнительные раунды и запросы за пределами согласованного объёма требуют отдельной оценки и письменного согласования до начала работ.`
    : `${p.revisionRounds} round${p.revisionRounds === 1 ? '' : 's'} of consolidated revisions included. Additional rounds and requests outside this scope require a separate estimate and written approval before work begins.`;
  const list = (entries: string[]) => entries.filter(entry => entry.trim()).map(entry => `<li>${esc(entry)}</li>`).join('');
  const dateCreated = new Date(p.createdAt).toLocaleDateString(localeFor(language), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} — ${label('Proposal')}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eeefea;color:#252c28;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65}.sheet{max-width:850px;margin:40px auto;padding:64px 66px;background:#fff;box-shadow:0 6px 35px #2026240d}.masthead{display:flex;align-items:start;justify-content:space-between;border-bottom:1px solid #dfe3dc;padding-bottom:28px;gap:24px}.studio{font-size:20px;font-weight:700;letter-spacing:-.6px}.muted{color:#6b746d}.eyebrow{text-transform:uppercase;font-size:10px;font-weight:700;letter-spacing:2px;color:#55745f}.title{font-size:40px;line-height:1.15;letter-spacing:-1.6px;font-weight:600;margin:28px 0 18px}.intro{font-size:16px;line-height:1.75;white-space:pre-line;max-width:650px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:28px 0 36px}.meta p{margin:4px 0}h2{font-size:19px;letter-spacing:-.5px;margin:34px 0 14px}table{width:100%;border-collapse:collapse}th{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#69786d;text-align:left;padding:12px 0;border-bottom:1px solid #dbe1da}td{vertical-align:top;padding:16px 0;border-bottom:1px solid #edf0eb}th:last-child,td:last-child{text-align:right;white-space:nowrap;padding-left:20px}.item-name{font-weight:700}.item-desc{font-size:12px;color:#69736c;white-space:pre-line}.totals{margin:20px 0 28px auto;max-width:320px}.sum{display:flex;justify-content:space-between;gap:20px;margin:8px 0}.sum.total{border-top:1px solid #dbe1da;padding-top:13px;font-size:22px;font-weight:700}.deposit{padding:18px 22px;background:#f1f5ed;border-radius:8px;display:flex;justify-content:space-between;gap:20px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:34px}.columns h2{margin-top:24px}ul{padding-left:18px;margin:0}li{margin:7px 0}section,p,li{overflow-wrap:anywhere}.terms{white-space:pre-line}.footer{border-top:1px solid #dfe3dc;margin-top:40px;padding-top:18px;color:#788278;font-size:11px}.watermark{color:#527244;font-size:11px;margin-top:12px}tr,.deposit,.meta{break-inside:avoid}h2{break-after:avoid}
@media(max-width:650px){.sheet{margin:0;padding:30px 24px}.title{font-size:32px}.columns,.meta{grid-template-columns:1fr;gap:8px}.masthead{flex-direction:column}.deposit{flex-direction:column;gap:3px}}
@media print{@page{size:A4;margin:16mm}body{background:#fff}.sheet{max-width:none;margin:0;padding:0;box-shadow:none}.columns,.meta{grid-template-columns:1fr 1fr}.masthead{flex-direction:row}.title{font-size:34px}.deposit{print-color-adjust:exact;-webkit-print-color-adjust:exact}.footer{margin-top:28px}a{color:inherit}}
</style></head><body><main class="sheet">
<header class="masthead"><div><div class="studio">${esc(p.studioName || t('Your studio'))}</div><div class="muted">${esc(p.studioEmail)}</div></div><div><div class="eyebrow">${label('Project proposal')}</div><div class="muted">${esc(dateCreated)}</div><div class="muted">${label('Valid for {count} {days} from issue', { count: p.validDays, days: language === 'ru' ? russianPlural(p.validDays, ['день', 'дня', 'дней']) : 'days' })}</div></div></header>
<h1 class="title">${esc(p.title || t('Project proposal'))}</h1><p class="intro">${esc(p.description)}</p>
<div class="meta"><div><div class="eyebrow">${label('Prepared for')}</div><p><strong>${esc(p.clientCompany || p.clientName || t('Client'))}</strong><br>${p.clientCompany ? `${esc(p.clientName)}<br>` : ''}${esc(p.clientEmail)}</p></div><div><div class="eyebrow">${label('Timeline')}</div><p>${esc(p.timeline || t('To be agreed before work begins'))}</p></div></div>
<h2>${label('Your investment')}</h2><table><thead><tr><th>${label('Deliverable')}</th><th>${label('Fee ({currency})', {currency: p.currency})}</th></tr></thead><tbody>${p.items.map(item => `<tr><td><div class="item-name">${esc(item.name || t('Project work'))}</div><div class="item-desc">${esc(item.description)}</div></td><td>${money(cents(item.hours * item.rate))}</td></tr>`).join('')}</tbody></table>
<div class="totals"><div class="sum"><span>${label('Project fee')}</span><span>${money(totals.fee)}</span></div>${p.taxPercent > 0 ? `<div class="sum"><span>${label('Tax ({percent})', {percent: percentText(p.taxPercent)})}</span><span>${money(totals.tax)}</span></div>` : ''}<div class="sum total"><span>${label('Total')}</span><span>${money(totals.total)}</span></div></div>
<div class="deposit"><span>${label('{percent} deposit to reserve your project', {percent: percentText(p.depositPercent)})}</span><strong>${money(totals.deposit)}</strong></div><div class="sum muted"><span>${label('Balance due before handoff')}</span><span>${money(totals.balance)}</span></div>
<div class="columns"><section><h2>${label('Included in this scope')}</h2><ul>${list(p.included) || `<li>${label('To be agreed before work begins.')}</li>`}</ul></section><section><h2>${label('Outside this scope')}</h2><ul>${list(p.excluded) || `<li>${label('Additional work is estimated separately.')}</li>`}</ul></section></div>
<h2>${label('Feedback & revisions')}</h2><p>${esc(revisions)}</p>
${p.notes.trim() ? `<h2>${label('Working together')}</h2><p class="terms">${esc(p.notes)}</p>` : ''}
<footer class="footer">${label('This document is a project proposal, not a signed contract or tax invoice. Confirm scope, payment terms, ownership, and acceptance in your agreement before starting work.')}${options.watermark ? `<div class="watermark">${label('Prepared with Scopebook · scopebook')}</div>` : ''}</footer>
</main></body></html>`;
}
