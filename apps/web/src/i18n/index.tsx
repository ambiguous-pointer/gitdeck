/**
 * Lightweight i18n: provider + `t(key, fallback, params)` translator.
 *
 * - Chinese and English dictionaries live in this folder.
 * - Missing translations gracefully fall back to the English dictionary and
 *   then to the fallback text passed by the caller (usually the English UI
 *   string), so a missing key never breaks the UI.
 * - `scripts/check-i18n.mjs` scans the codebase for keys and reports gaps.
 */
import type { Locale } from '@gitdeck/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './dict.en';
import { zh } from './dict.zh';

export const LOCALE_STORAGE_KEY = 'gitdeck.locale';

export type TranslationParams = Record<string, string | number>;
export type Translator = (key: string, fallback?: string, params?: TranslationParams) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: Translator;
  availableLocales: { value: Locale; label: string }[];
}

const DICTIONARIES: Record<Locale, Record<string, string>> = { zh, en };

const LOCALE_LABELS: Record<Locale, string> = { zh: '中文', en: 'English' };

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  const language = window.navigator.language.toLowerCase();
  return language.startsWith('zh') ? 'zh' : 'en';
}

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const t = useCallback<Translator>(
    (key, fallback, params) => {
      const dictionary = DICTIONARIES[locale];
      const value = dictionary[key] ?? en[key] ?? fallback ?? key;
      return interpolate(value, params);
    },
    [locale],
  );

  const setLocale = useCallback((next: Locale) => setLocaleState(next === 'en' ? 'en' : 'zh'), []);
  const toggleLocale = useCallback(() => setLocaleState((current) => (current === 'zh' ? 'en' : 'zh')), []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      availableLocales: [
        { value: 'zh', label: LOCALE_LABELS.zh },
        { value: 'en', label: LOCALE_LABELS.en },
      ],
    }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
