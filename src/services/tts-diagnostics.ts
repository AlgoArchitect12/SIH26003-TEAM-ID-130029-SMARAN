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
  lastEvent = event;

  if (__DEV__) {
    console.log('[SMARAN][TTS]', event);
  }
}

export function getLastTtsDiagnostic() {
  return lastEvent;
}

export function clearTtsDiagnostics() {
  lastEvent = null;
}
