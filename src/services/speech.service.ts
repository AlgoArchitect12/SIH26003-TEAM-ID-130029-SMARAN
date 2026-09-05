import * as Speech from 'expo-speech';

import type { Language } from '@db/schema.types';

export type SpeechOutcome = 'failed' | 'started' | 'unavailable';

const preferredLocales: Record<Language, readonly string[]> = {
  as: ['as-IN'],
  bn: ['bn-IN', 'bn-BD'],
  en: ['en-IN', 'en-US', 'en-GB'],
  hi: ['hi-IN'],
  kha: ['kha-IN'],
  lus: ['lus-IN'],
  mni: ['mni-IN', 'mni-Beng-IN', 'mni-Mtei-IN'],
};

type SpeechCallbacks = {
  onDone?: () => void;
  onError?: () => void;
};

let speechRequest = 0;

function normalizeLocale(locale: string) {
  return locale.replace('_', '-').toLowerCase();
}

function findVoice(voices: Speech.Voice[], language: Language) {
  const locales = preferredLocales[language].map(normalizeLocale);
  return (
    voices.find((voice) => locales.includes(normalizeLocale(voice.language))) ??
    voices.find((voice) => normalizeLocale(voice.language).startsWith(`${language}-`))
  );
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
    const voice = findVoice(await Speech.getAvailableVoicesAsync(), language);
    if (request !== speechRequest) return 'failed';
    if (!voice) {
      return 'unavailable';
    }

    Speech.speak(spokenText, {
      language: voice.language,
      onDone: callbacks.onDone,
      onError: (error) => {
        if (request !== speechRequest) {
          callbacks.onDone?.();
          return;
        }
        if (__DEV__) {
          console.warn('Screen reading stopped unexpectedly', error);
        }
        callbacks.onError?.();
      },
      onStopped: callbacks.onDone,
      pitch: 1,
      rate: 0.8,
      voice: voice.identifier,
    });
    return 'started';
  } catch (error) {
    if (__DEV__) {
      console.warn('Screen reading is unavailable', error);
    }
    return 'failed';
  }
}

export async function stopSpeech() {
  speechRequest += 1;
  try {
    await Speech.stop();
  } catch {
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
