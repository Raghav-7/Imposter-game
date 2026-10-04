import { getLocales } from 'expo-localization';
import { useMemo } from 'react';

import { type LanguageSetting, useSettings } from '../state/settings';
import { type Dictionary, en, type TranslationKey } from './en';
import { hi } from './hi';

export type Language = 'en' | 'hi';
export type TParams = Record<string, string | number>;
export type TFunction = (key: TranslationKey, params?: TParams) => string;

const DICTIONARIES: Record<Language, Dictionary> = { en, hi };

export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', hi: 'हिन्दी' };

export function resolveLanguage(setting: LanguageSetting): Language {
  if (setting !== 'system') return setting;
  try {
    const code = getLocales()[0]?.languageCode;
    return code === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

function lookup(lang: Language, key: string): string | undefined {
  return (DICTIONARIES[lang] as Record<string, string | undefined>)[key] ?? (en as Record<string, string>)[key];
}

export function translate(lang: Language, key: TranslationKey, params?: TParams): string {
  let template: string | undefined;
  const count = params?.count;
  if (typeof count === 'number') {
    const base = key.replace(/_(one|other)$/, '');
    template = lookup(lang, `${base}_${count === 1 ? 'one' : 'other'}`);
  }
  template ??= lookup(lang, key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

export function useLanguage(): Language {
  const { language } = useSettings();
  return useMemo(() => resolveLanguage(language), [language]);
}

export function useT(): TFunction {
  const lang = useLanguage();
  return useMemo(() => (key: TranslationKey, params?: TParams) => translate(lang, key, params), [lang]);
}

export type { TranslationKey };
