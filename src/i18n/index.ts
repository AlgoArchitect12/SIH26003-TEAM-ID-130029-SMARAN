import type { Language, Region, TextSize } from '@db/schema.types';

import { regionNames, strings, type TranslationKey } from './strings';

export function t(
  language: Language | null | undefined,
  key: TranslationKey,
  values: Record<string, string> = {}
) {
  const template = strings[language ?? 'en']?.[key] ?? strings.en[key];
  if (!template) return `[${key}]`;
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);
}

export function getRegionName(language: Language | null | undefined, region: Region) {
  return regionNames[language ?? 'en']?.[region] ?? regionNames.en[region];
}

export const languageDisplayNames: Record<Language, string> = {
  as: 'অসমীয়া',
  bn: 'বাংলা',
  en: 'English',
  hi: 'हिन्दी',
  kha: 'Khasi',
  lus: 'Mizo',
  mni: 'Meitei (Manipuri)',
};

const languageHelpers: Partial<Record<Language, string>> = {
  as: 'Assamese',
  bn: 'Bengali',
  hi: 'Hindi',
  kha: 'Khasi',
  lus: 'Mizo',
  mni: 'Meitei / Manipuri',
};

const textSizeKeys: Record<TextSize, TranslationKey> = {
  'extra-large': 'extraLarge',
  large: 'large',
  standard: 'standard',
};

export function getLanguageName(language: Language) {
  return languageDisplayNames[language];
}

export function getLanguageHelper(language: Language) {
  return languageHelpers[language];
}

export function getTextSizeName(language: Language, textSize: TextSize) {
  return t(language, textSizeKeys[textSize]);
}

export { regionNames, strings, type TranslationKey } from './strings';
