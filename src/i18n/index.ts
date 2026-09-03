import type { Language, Region, TextSize } from '@db/schema.types';

import { regionNames, strings, type TranslationKey } from './strings';

export function t(
  language: Language | null | undefined,
  key: TranslationKey,
  values: Record<string, string> = {}
) {
  const template = strings[language ?? 'en'][key] ?? strings.en[key];
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);
}

export function getRegionName(language: Language | null | undefined, region: Region) {
  return regionNames[language ?? 'en'][region];
}

const languageNameKeys: Record<Language, TranslationKey> = {
  as: 'languageAssamese',
  en: 'languageEnglish',
  hi: 'languageHindi',
};

const textSizeKeys: Record<TextSize, TranslationKey> = {
  'extra-large': 'extraLarge',
  large: 'large',
  standard: 'standard',
};

export function getLanguageName(language: Language) {
  return t(language, languageNameKeys[language]);
}

export function getTextSizeName(language: Language, textSize: TextSize) {
  return t(language, textSizeKeys[textSize]);
}

export { regionNames, strings, type TranslationKey } from './strings';
