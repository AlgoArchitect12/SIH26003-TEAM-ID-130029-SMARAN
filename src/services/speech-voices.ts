import type { Language } from '../db/schema.types';

export type DeviceVoice = {
  identifier?: string | null;
  language?: string | null;
  name?: string | null;
};

export const preferredLocales: Record<Language, readonly string[]> = {
  as: ['as-IN'],
  bn: ['bn-IN', 'bn-BD'],
  en: ['en-IN', 'en-US', 'en-GB'],
  hi: ['hi-IN'],
  kha: ['kha-IN'],
  lus: ['lus-IN'],
  mni: ['mni-Latn-IN'],
};

export function normalizeLocale(locale: string) {
  return locale.replace(/_/gu, '-').toLowerCase();
}

export function languagePart(locale: string) {
  return normalizeLocale(locale).split('-')[0];
}

export function matchesMeiteiScript(locale: string) {
  return normalizeLocale(locale).split('-').includes('latn');
}

export function resolveDeviceVoice(
  voices: readonly DeviceVoice[],
  language: Language,
): DeviceVoice | null {
  const preferred = preferredLocales[language].map(normalizeLocale);

  const suitable = voices.filter((voice) => {
    if (!voice.identifier || !voice.language) return false;
    return language !== 'mni' || matchesMeiteiScript(voice.language);
  });

  // Prefer the requested locale order.
  for (const locale of preferred) {
    const exact = suitable.find(
      (voice) => normalizeLocale(voice.language!) === locale,
    );
    if (exact) return exact;
  }

  // Then accept another region for the same language.
  return (
    suitable.find(
      (voice) => languagePart(voice.language!) === language,
    ) ?? null
  );
}

export function fallbackLocale(language: Language) {
  return preferredLocales[language][0];
}
