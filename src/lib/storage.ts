import { parseBackup, serializeBackup, type Proposal } from './proposals';

const STORAGE_KEY = 'scopebook.proposals.v1';
const SETTINGS_KEY = 'scopebook.settings.v1';

export interface StudioSettings {
  studioName: string;
  studioEmail: string;
  hourlyRate: number;
  currency: 'USD' | 'EUR' | 'GBP';
}
export const defaultSettings: StudioSettings = { studioName: 'Your studio', studioEmail: '', hourlyRate: 65, currency: 'USD' };

export function loadProposals(): Proposal[] {
  const value = localStorage.getItem(STORAGE_KEY);
  return value ? parseBackup(value) : [];
}
export function saveProposals(proposals: Proposal[]): void {
  localStorage.setItem(STORAGE_KEY, serializeBackup(proposals));
}
export function loadSettings(): StudioSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  const value = JSON.parse(raw);
  if (!value || typeof value.studioName !== 'string' || typeof value.studioEmail !== 'string' ||
      !['USD', 'EUR', 'GBP'].includes(value.currency) || !Number.isFinite(value.hourlyRate) || value.hourlyRate < 0 || value.hourlyRate > 100000) {
    throw new Error('Saved studio settings could not be read.');
  }
  return value;
}
export function saveSettings(value: StudioSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
}
export function downloadFile(content: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function fileName(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'proposal';
}
