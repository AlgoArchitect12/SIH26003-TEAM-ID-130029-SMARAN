import type { CognitiveActivityType, Language } from '../db/schema.types';
import { captureAccount, getCloudClient } from './auth';

// Explicit opt-in call only; game play continues to use cognitive-coach.ts with no network dependency.
export async function requestOnlineInstruction(activity: CognitiveActivityType, language: Language) {
  const account = captureAccount();
  if (!account.current()) return { available: false, reason: 'local' } as const;
  try {
    const { data, error } = await getCloudClient().functions.invoke('online-ai', {
      body: { version: 1, task: 'game-instruction', activity, language }, signal: account.signal, timeout: 15000,
    });
    if (!account.current()) return { available: false, reason: 'local' } as const;
    if (error && 'context' in error && error.context instanceof Response && error.context.status === 503) {
      const result = await error.context.json();
      if (account.current() && result?.ok === false && result?.error?.code === 'not-configured') return { available: false, reason: 'not-configured' } as const;
    }
    if (!error && data?.ok === false && data?.error?.code === 'not-configured') return { available: false, reason: 'not-configured' } as const;
    // A 503 is the truthful MVP-22 contract. Never display unvalidated provider prose.
    return { available: false, reason: 'unavailable' } as const;
  } catch { return { available: false, reason: 'unavailable' } as const; }
}
