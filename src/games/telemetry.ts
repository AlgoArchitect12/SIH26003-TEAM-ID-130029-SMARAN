import type { CognitiveSession, CognitiveSessionMetrics } from '../db/schema.types';
import type { CompletedMemoryTelemetry } from './memory-match/telemetry';

type SelectionTelemetryEnvelope = {
  attempts: number;
  accuracy: number;
  hintsUsed: number;
  averageResponseMs: number;
  startedAtMs: number;
  completedAtMs: number;
};
export type CompletedPatternTelemetry = SelectionTelemetryEnvelope & Extract<CognitiveSessionMetrics, { gameType: 'pattern_recognition' }>;
export type CompletedRoutineTelemetry = SelectionTelemetryEnvelope & Extract<CognitiveSessionMetrics, { gameType: 'routine_recall' }>;
export type CompletedSelectionTelemetry = SelectionTelemetryEnvelope & Exclude<CognitiveSessionMetrics, { gameType: 'memory_match' }>;
export type CompletedCognitiveTelemetry = CompletedMemoryTelemetry | CompletedSelectionTelemetry;

export function activityMetrics(value: CognitiveSessionMetrics): CognitiveSessionMetrics {
  switch (value.gameType) {
    case 'memory_match': return { gameType: value.gameType, totalPairs: value.totalPairs, matches: value.matches, repeatedMistakes: value.repeatedMistakes };
    case 'pattern_recognition':
    case 'familiar_object':
    case 'picture_recall': return { gameType: value.gameType, challengesCompleted: value.challengesCompleted, correctSelections: value.correctSelections, repeatedErrors: value.repeatedErrors };
    case 'routine_recall':
    case 'remember_lights':
    case 'number_path':
    case 'sequence_memory': return { gameType: value.gameType, stepsCompleted: value.stepsCompleted, correctSelections: value.correctSelections, repeatedErrors: value.repeatedErrors };
  }
}

export function sessionTelemetry(session: CognitiveSession): CompletedCognitiveTelemetry {
  const common = {
    accuracy: session.accuracy, attempts: session.attempts, hintsUsed: session.hintsUsed,
    averageResponseMs: session.averageResponseMs, startedAtMs: Date.parse(session.startedAt), completedAtMs: Date.parse(session.completedAt),
  };
  const metrics = activityMetrics(session);
  return metrics.gameType === 'memory_match'
    ? { ...common, ...metrics, idleTimeBeforeFirstFlipMs: 0 }
    : { ...common, ...metrics };
}
