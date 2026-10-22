import { commonRu } from '../locales/common';
import { landingRu } from '../locales/landing';
import { workspaceRu } from '../locales/workspace';
import { domainErrorRu, domainRu } from '../locales/domain';

export type Language = 'en' | 'ru';
export type TranslationVariables = Record<string, string | number>;
export const LANGUAGE_STORAGE_KEY = 'scopebook.language.v1';
export const russianTranslations: Readonly<Record<string, string>> = { ...landingRu, ...workspaceRu, ...domainRu, ...commonRu };

export function localeFor(language: Language): 'ru-RU' | 'en-US' {
  return language === 'ru' ? 'ru-RU' : 'en-US';
}

export function translate(language: Language, key: string, variables: TranslationVariables = {}): string {
  const text = language === 'ru' ? russianTranslations[key] ?? key : key;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : placeholder);
}

/** Only known, authored errors are translated. Unknown server details stay out of the UI. */
export function translateError(message: string, language: Language): string {
  if (language === 'en') return message;
  if (russianTranslations[message]) return russianTranslations[message];
  const domainMessage = domainErrorRu(message);
  if (domainMessage) return domainMessage;
  if (/[А-Яа-яЁё]/.test(message)) return message;
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export function preferredLanguage(saved: string | null, browserLanguages: readonly string[] = []): Language {
  if (saved === 'ru' || saved === 'en') return saved;
  for (const candidate of browserLanguages) {
    const language = candidate.toLowerCase().split('-')[0];
    if (language === 'ru' || language === 'en') return language;
  }
  return 'en';
}
