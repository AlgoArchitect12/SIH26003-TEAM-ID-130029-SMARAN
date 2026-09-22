import * as Speech from 'expo-speech';

import { Languages, type Language } from '../db/schema.types';
import { fallbackLocale, resolveDeviceVoice, type DeviceVoice } from './speech-voices';
import { recordTtsDiagnostic } from './tts-diagnostics';

export type SpeechOutcome = 'failed' | 'started' | 'unavailable';

type SpeechCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
};

type VoiceLookup = {
  voices: Speech.Voice[];
  checked: boolean;
};

let speechRequest = 0;
let voiceCache: { value: VoiceLookup; expiresAt: number } | null = null;

async function loadVoices(force = false): Promise<VoiceLookup> {
  const now = Date.now();

  if (!force && voiceCache && voiceCache.expiresAt > now) {
    return voiceCache.value;
  }

  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const value = { voices, checked: true };
    // Device voice lists can change after language packs are installed.
    // Keep the cache short so settings changes become visible quickly.
    voiceCache = { value, expiresAt: now + 30_000 };
    return value;
  } catch (error) {
    if (__DEV__) {
      console.warn('[SMARAN][TTS] Could not enumerate device voices.', error);
    }
    const value = { voices: [], checked: false };
    voiceCache = { value, expiresAt: now + 5_000 };
    return value;
  }
}

function findVoice(voices: Speech.Voice[], language: Language) {
  return resolveDeviceVoice(voices as DeviceVoice[], language) as Speech.Voice | null;
}

export type LanguageVoiceCapability = {
  language: Language;
  uiTranslation: true;
  tts: 'available' | 'unavailable' | 'unknown';
  voice: Speech.Voice | null;
  stt: 'not-implemented';
};

export async function getVoiceCapabilities(): Promise<LanguageVoiceCapability[]> {
  const { voices, checked } = await loadVoices(true);

  return Languages.map((language) => {
    const voice = findVoice(voices, language) ?? null;

    return {
      language,
      uiTranslation: true,
      tts: checked
        ? voice
          ? 'available'
          : 'unavailable'
        : 'unknown',
      voice,
      stt: 'not-implemented',
    };
  });
}

function invalidMeiteiText(language: Language, text: string) {
  return (
    language === 'mni' &&
    /[\u0980-\u09ff\uabc0-\uabff]/u.test(text)
  );
}

export async function speakScreenText(
  text: string,
  language: Language,
  callbacks: SpeechCallbacks = {},
): Promise<SpeechOutcome> {
  const spokenText = text.trim().slice(0, Speech.maxSpeechInputLength);

  if (!spokenText) {
    return 'failed';
  }

  if (invalidMeiteiText(language, spokenText)) {
    return 'unavailable';
  }

  const request = ++speechRequest;
  let voiceLookup = await loadVoices(true);
  let voice = findVoice(voiceLookup.voices, language);

  if (request !== speechRequest) {
    return 'failed';
  }

  try {
    await Speech.stop();

    if (request !== speechRequest) {
      return 'failed';
    }

    let fallbackAttempted = false;

    const speak = (useExplicitVoice: boolean) => {
      if (request !== speechRequest) {
        return;
      }

      const preferredLanguage =
        voice?.language ?? fallbackLocale(language);

      const attempt = useExplicitVoice
        ? 'explicit-voice'
        : 'language-fallback';

      recordTtsDiagnostic({
        attempt,
        language,
        locale: preferredLanguage,
        voiceId: voice?.identifier ?? null,
        voiceLanguage: voice?.language ?? null,
        event: 'requested',
        at: new Date().toISOString(),
      });

      Speech.speak(spokenText, {
        language: preferredLanguage,

        ...(useExplicitVoice && voice?.identifier
          ? { voice: voice.identifier }
          : {}),

        pitch: 1,
        rate: 0.8,
        volume: 1,

        onStart: () => {
          if (request !== speechRequest) {
            return;
          }

          recordTtsDiagnostic({
            attempt,
            language,
            locale: preferredLanguage,
            voiceId: voice?.identifier ?? null,
            voiceLanguage: voice?.language ?? null,
            event: 'start',
            at: new Date().toISOString(),
          });

          callbacks.onStart?.();
        },

        onDone: () => {
          if (request !== speechRequest) {
            return;
          }

          recordTtsDiagnostic({
            attempt,
            language,
            locale: preferredLanguage,
            voiceId: voice?.identifier ?? null,
            voiceLanguage: voice?.language ?? null,
            event: 'done',
            at: new Date().toISOString(),
          });

          callbacks.onDone?.();
        },

        onStopped: () => {
          if (request !== speechRequest) {
            return;
          }

          recordTtsDiagnostic({
            attempt,
            language,
            locale: preferredLanguage,
            voiceId: voice?.identifier ?? null,
            voiceLanguage: voice?.language ?? null,
            event: 'done',
            at: new Date().toISOString(),
          });

          callbacks.onDone?.();
        },

        onError: (error) => {
          if (request !== speechRequest) {
            return;
          }

          recordTtsDiagnostic({
            attempt,
            language,
            locale: preferredLanguage,
            voiceId: voice?.identifier ?? null,
            voiceLanguage: voice?.language ?? null,
            event: 'error',
            errorName: error?.name,
            errorMessage: error?.message,
            at: new Date().toISOString(),
          });

          if (__DEV__) {
            console.warn('[SMARAN][TTS] Speech engine error.', {
              language,
              requestedLocale: preferredLanguage,
              voice: voice?.identifier ?? null,
              voiceLanguage: voice?.language ?? null,
              errorName: error?.name,
              errorMessage: error?.message,
            });
          }

          // Some Android TTS engines enumerate a voice successfully but
          // fail when that exact voice is explicitly selected. Retry once
          // using the language and let the engine select its own voice.
          if (voice && !fallbackAttempted && useExplicitVoice) {
            fallbackAttempted = true;

            void Speech.stop()
              .catch(() => undefined)
              .then(() => {
                if (request !== speechRequest) {
                  return;
                }

                // Refresh once before retrying. The installed voice list can
                // change while the app is running.
                return loadVoices(true).then((latest) => {
                  if (request !== speechRequest) {
                    return;
                  }

                  voiceLookup = latest;
                  voice = findVoice(latest.voices, language);

                  speak(false);
                });
              })
              .catch((retryError) => {
                if (__DEV__) {
                  console.warn(
                    '[SMARAN][TTS] Language-only fallback failed.',
                    retryError,
                  );
                }

                if (request === speechRequest) {
                  callbacks.onError?.();
                }
              });

            return;
          }

          callbacks.onError?.();
        },
      });
    };

    // Prefer an exact/compatible device voice when one exists.
    // Otherwise still attempt language-only synthesis instead of declaring
    // the feature unavailable before the Android engine has a chance.
    speak(!!voice);

    return 'started';
  } catch (error) {
    if (__DEV__) {
      console.warn('[SMARAN][TTS] Speech invocation failed.', {
        language,
        voice: voice?.identifier ?? null,
        error,
      });
    }

    return 'failed';
  }
}

export async function stopSpeech(required = false) {
  speechRequest += 1;

  try {
    await Speech.stop();
  } catch {
    if (required) {
      throw new Error('Screen reading could not be stopped.');
    }
  }
}

export async function isSpeaking() {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
