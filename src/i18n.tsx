import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGUAGE_STORAGE_KEY, localeFor, preferredLanguage, translate, type Language, type TranslationVariables } from './lib/locale';

interface LanguageContext {
  language: Language;
  locale: 'ru-RU' | 'en-US';
  setLanguage: (language: Language) => void;
  t: (key: string, variables?: TranslationVariables) => string;
}
const Context = createContext<LanguageContext | null>(null);

function initialLanguage(): Language {
  let saved: string | null = null;
  try { saved = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* The current session still works when storage is unavailable. */ }
  return preferredLanguage(saved, typeof navigator === 'undefined' ? [] : navigator.languages || [navigator.language]);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(initialLanguage);
  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Retain the in-memory preference. */ }
  }, []);
  const t = useCallback((key: string, variables?: TranslationVariables) => translate(language, key, variables), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('Scopebook — Better scope. Better business.');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('Build profitable proposals, define your scope, and price extra work. Scopebook is a private workspace for independent studios.'));
  }, [language, t]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY && (event.newValue === 'en' || event.newValue === 'ru')) updateLanguage(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const value = useMemo(() => ({ language, setLanguage, locale: localeFor(language), t }), [language, setLanguage, t]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLanguage(): LanguageContext {
  const context = useContext(Context);
  if (!context) throw new Error('LanguageProvider is required.');
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-switcher" role="group" aria-label={t('Interface language')}>
    <button type="button" lang="ru" aria-label="Русский" aria-pressed={language === 'ru'} onClick={() => setLanguage('ru')}>RU</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}
