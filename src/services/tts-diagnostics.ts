export type TtsAttempt = 'explicit-voice' | 'language-fallback';

export type TtsDiagnosticEvent = {
  attempt: TtsAttempt;
  language: string;
  locale: string;
  voiceId: string | null;
  voiceLanguage: string | null;
  event: 'requested' | 'start' | 'done' | 'error';
  errorName?: string;
  errorMessage?: string;
  at: string;
};

let lastEvent: TtsDiagnosticEvent | null = null;

export function recordTtsDiagnostic(event: TtsDiagnosticEvent) {
  // Retain useful diagnostic state in memory only. Never log patient text,
  // coordinates, report contents, contacts, credentials, or runtime payloads.
  lastEvent = event;

  if (__DEV__) {
    console.log('[SMARAN][TTS] diagnostic recorded');
  }
}

export function getLastTtsDiagnostic() {
  return lastEvent;
}

export function clearTtsDiagnostics() {
  lastEvent = null;
}
