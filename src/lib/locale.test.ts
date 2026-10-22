import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { preferredLanguage, russianTranslations, translate, translateError } from './locale';
import { fileName, getDefaultSettings } from './storage';

describe('language selection and localization', () => {
  it('uses a saved choice before the browser, detects Russian variants, and handles unavailable preferences', () => {
    expect(preferredLanguage('en', ['ru-RU'])).toBe('en');
    expect(preferredLanguage('ru', ['en-US'])).toBe('ru');
    expect(preferredLanguage(null, ['ru-RU', 'en-US'])).toBe('ru');
    expect(preferredLanguage('invalid', ['de-DE', 'RU-ru'])).toBe('ru');
    expect(preferredLanguage(null, ['en-GB', 'ru'])).toBe('en');
    expect(preferredLanguage(null, ['fr-FR'])).toBe('en');
    expect(preferredLanguage(null)).toBe('en');
  });

  it('interpolates complete messages while preserving user-provided text', () => {
    expect(translate('en', 'Fee ({currency})', { currency: 'EUR' })).toBe('Fee (EUR)');
    expect(translate('ru', 'Fee ({currency})', { currency: 'EUR' })).toContain('EUR');
    expect(translate('ru', 'Fee ({currency})', { currency: '<user text>' })).toContain('<user text>');
    expect(translate('en', 'Unknown')).toBe('Unknown');
  });

  it('preserves every interpolation placeholder in Russian translations', () => {
    const tokens = (text: string) => [...new Set(text.match(/\{\w+\}/g) || [])].sort();
    for (const [key, value] of Object.entries(russianTranslations)) {
      expect(tokens(value), key).toEqual(tokens(key));
    }
  });

  it('provides Russian entries for all statically authored UI and document translation keys', () => {
    const missing: string[] = [];
    for (const name of ['src/App.tsx', 'src/Landing.tsx', 'src/lib/proposals.ts', 'src/i18n.tsx']) {
      const source = ts.createSourceFile(name, readFileSync(name, 'utf8'), ts.ScriptTarget.Latest, true, name.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const index = node.expression.text === 'translate' ? 1 : ['t', 'label'].includes(node.expression.text) ? 0 : -1;
          const key = index < 0 ? undefined : node.arguments[index];
          if (key && ts.isStringLiteral(key) && /[A-Za-z]{2}/.test(key.text) && !(key.text in russianTranslations)) missing.push(`${name}: ${key.text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });

  it('translates server and dynamic validation errors without leaking untranslated unknown errors', () => {
    expect(translateError('That recovery key is invalid or no longer active.', 'ru')).toContain('Ключ');
    expect(translateError('Line hours must be a number between 0 and 100000.', 'ru')).toMatch(/[А-Яа-я]/);
    expect(translateError('This file is not valid JSON. Choose a Scopebook backup.', 'ru')).toMatch(/[А-Яа-я]/);
    expect(translateError('Unexpected proxy diagnostic', 'ru')).not.toMatch(/[A-Za-z]/);
    expect(translateError('Original error', 'en')).toBe('Original error');
  });

  it('uses Russian defaults and retains Cyrillic in safe export filenames', () => {
    expect(getDefaultSettings('ru').studioName).toBe('Ваша студия');
    expect(getDefaultSettings('en').studioName).toBe('Your studio');
    expect(fileName('Сайт для кофейни / 2026')).toBe('сайт-для-кофейни-2026');
    expect(fileName('../../<script>')).toBe('script');
    expect(fileName('Juniper launch proposal')).toBe('juniper-launch-proposal');
  });
});
