import type { CognitiveActivityType, CognitiveSession, CognitiveSessionMetrics, Language } from '../db/schema.types';
import { t, type TranslationKey } from '../i18n/index';

export const activityTitleKeys = {
  memory_match: 'gameTitle', pattern_recognition: 'patternTitle', routine_recall: 'routineTitle',
} as const satisfies Record<CognitiveActivityType, TranslationKey>;

export function activitySummary(language: Language, metrics: CognitiveSessionMetrics) {
  switch (metrics.gameType) {
    case 'memory_match': return t(language, 'resultSummaryPairs', { pairs: String(metrics.totalPairs) });
    case 'pattern_recognition': return t(language, 'patternsCompleted', { count: String(metrics.challengesCompleted) });
    case 'routine_recall': return t(language, 'stepsCompleted', { count: String(metrics.stepsCompleted) });
  }
}

export function activityFacts(language: Language, session: CognitiveSession) {
  const number = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  const accuracy = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(session.accuracy);
  if (session.gameType === 'memory_match') return t(language, 'careFacts', {
    accuracy, pairs: number(session.totalPairs), attempts: number(session.attempts),
    hints: number(session.hintsUsed), ms: number(session.averageResponseMs),
  });
  return [
    activitySummary(language, session), t(language, 'activityAccuracy', { accuracy }),
    t(language, 'selectionsAttempts', { count: number(session.attempts) }),
    t(language, 'resultHints', { hints: number(session.hintsUsed) }),
  ].join('. ');
}
