import * as Speech from 'expo-speech';

import { Languages, type Language } from '../db/schema.types';

export type SpeechOutcome = 'failed' | 'started' | 'unavailable';

const preferredLocales: Record<Language, readonly string[]> = {
  as: ['as-IN'],
  bn: ['bn-IN', 'bn-BD'],
  en: ['en-IN', 'en-US', 'en-GB'],
  hi: ['hi-IN'],
  kha: ['kha-IN'],
  lus: ['lus-IN'],
  // The current Meitei catalog is romanized; Bengali/Meetei-script voices are not a suitable match.
  mni: ['mni-Latn-IN'],
};

type SpeechCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
};

let speechRequest = 0;

function normalizeLocale(locale: string) {
  return locale.replace(/_/g, '-').toLowerCase();
}

function findVoice(voices: Speech.Voice[], language: Language) {
  const locales = preferredLocales[language].map(normalizeLocale);
  const suitable = voices.filter(voice => voice.identifier && (language !== 'mni' || normalizeLocale(voice.language).split('-').includes('latn')));
  return (
    suitable.find((voice) => locales.includes(normalizeLocale(voice.language))) ??
    suitable.find((voice) => normalizeLocale(voice.language).split('-')[0] === language)
  );
}

export type LanguageVoiceCapability = {
  language: Language;
  uiTranslation: true;
  tts: 'available' | 'unavailable' | 'unknown';
  voice: Speech.Voice | null;
  // Native recognition is absent, so device STT language support has not been queried.
  stt: 'not-implemented';
};

export async function getVoiceCapabilities(): Promise<LanguageVoiceCapability[]> {
  let voices: Speech.Voice[] = [];
  let checked = false;
  try { voices = await Speech.getAvailableVoicesAsync(); checked = true; } catch { /* Text and touch remain available. */ }
  return Languages.map(language => {
    const voice = findVoice(voices, language) ?? null;
    return { language, uiTranslation: true, tts: checked ? voice ? 'available' : 'unavailable' : 'unknown', voice, stt: 'not-implemented' };
  });
}

export async function speakScreenText(
  text: string,
  language: Language,
  callbacks: SpeechCallbacks = {}
): Promise<SpeechOutcome> {
  const spokenText = text.trim().slice(0, Speech.maxSpeechInputLength);
  if (!spokenText) {
    return 'failed';
  }

  const request = ++speechRequest;
  try {
    await Speech.stop();
    if (request !== speechRequest) return 'failed';
    const voice = findVoice(await Speech.getAvailableVoicesAsync(), language);
    if (request !== speechRequest) return 'failed';
    if (!voice) {
      return 'unavailable';
    }

    Speech.speak(spokenText, {
      language: voice.language,
      onStart: () => { if (request === speechRequest) callbacks.onStart?.(); },
      onDone: () => { if (request === speechRequest) callbacks.onDone?.(); },
      onError: () => {
        if (request !== speechRequest) {
          return;
        }
        if (__DEV__) {
          console.warn('Screen reading stopped unexpectedly');
        }
        callbacks.onError?.();
      },
      onStopped: () => { if (request === speechRequest) callbacks.onDone?.(); },
      pitch: 1,
      rate: 0.8,
      voice: voice.identifier,
    });
    return 'started';
  } catch {
    if (__DEV__) {
      console.warn('Screen reading is unavailable');
    }
    return 'failed';
  }
}

export async function stopSpeech(required = false) {
  speechRequest += 1;
  try {
    await Speech.stop();
  } catch {
    if (required) throw new Error('Screen reading could not be stopped.');
    // Speech is optional assistance; there is nothing else to clean up when unavailable.
  }
}

export async function isSpeaking() {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
