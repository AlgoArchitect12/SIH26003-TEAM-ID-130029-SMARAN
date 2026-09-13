import type { AdaptiveSessionInput, FeatureExtraction } from './types';
import type { CognitiveSession } from '../db/schema.types';
import type { CompletedMemoryTelemetry } from '../games/memory-match/telemetry';
import type { CompletedPatternTelemetry, CompletedRoutineTelemetry, CompletedSelectionTelemetry } from '../games/telemetry';

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function average(values: readonly number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function complexityAdjustedPace(milliseconds: number, totalPairs: number) {
  return milliseconds / Math.sqrt(Math.max(1, totalPairs));
}

export function extractAdaptiveFeatures(input: AdaptiveSessionInput): FeatureExtraction {
  switch (input.telemetry.gameType) {
    case 'memory_match': return extractMemoryFeatures({ ...input, telemetry: input.telemetry });
    case 'pattern_recognition': return extractPatternFeatures({ ...input, telemetry: input.telemetry });
    case 'routine_recall': return extractRoutineFeatures({ ...input, telemetry: input.telemetry });
    case 'familiar_object':
    case 'remember_lights':
    case 'number_path':
    case 'sequence_memory':
    case 'picture_recall': return extractSelectionFeatures({ ...input, telemetry: input.telemetry });
  }
}

function extractSelectionFeatures(input: Omit<AdaptiveSessionInput, 'telemetry'> & { telemetry: CompletedSelectionTelemetry }): FeatureExtraction {
  const baseline = selectionBaseline(input), value = input.telemetry;
  return {
    hasPersonalBaseline: baseline.hasPersonalBaseline, personalPaceBaselineMs: baseline.personalPaceBaselineMs,
    features: {
      accuracy: clamp01(value.accuracy), relativePace: baseline.relativePace,
      workingMemory: value.attempts ? clamp01(1 - value.repeatedErrors / value.attempts) : 0.5,
      independence: value.correctSelections ? clamp01(1 - value.hintsUsed / value.correctSelections) : 0.5,
      stability: baseline.stability,
    },
  };
}

function extractMemoryFeatures(input: Omit<AdaptiveSessionInput, 'telemetry'> & { telemetry: CompletedMemoryTelemetry }): FeatureExtraction {
  // Repository queries are patient-scoped; this additional filter keeps the pure boundary verifiable.
  const history = input.recentSessions
    .filter((session): session is Extract<CognitiveSession, { gameType: 'memory_match' }> =>
      session.patientId === input.patientId && !session.isDemoSeed && session.gameType === 'memory_match')
    .slice(0, 5);
  const personalPaces = history.map((session) =>
    complexityAdjustedPace(session.averageResponseMs, session.totalPairs)
  );
  const personalPaceBaselineMs = personalPaces.length === 0 ? null : average(personalPaces);
  const currentPace = complexityAdjustedPace(
    input.telemetry.averageResponseMs,
    input.telemetry.totalPairs
  );
  const relativePace =
    personalPaceBaselineMs === null || personalPaceBaselineMs <= 0
      ? 0.5
      : clamp01(0.5 + (personalPaceBaselineMs - currentPace) / (2 * personalPaceBaselineMs));
  const recentAccuracy = history.length === 0 ? null : average(history.map(({ accuracy }) => accuracy));

  return {
    features: {
      accuracy: clamp01(input.telemetry.accuracy),
      relativePace,
      workingMemory:
        input.telemetry.attempts === 0
          ? 0.5
          : clamp01(1 - input.telemetry.repeatedMistakes / input.telemetry.attempts),
      independence:
        input.telemetry.totalPairs === 0
          ? 0.5
          : clamp01(1 - input.telemetry.hintsUsed / input.telemetry.totalPairs),
      stability:
        recentAccuracy === null
          ? 0.5
          : clamp01(0.5 + (input.telemetry.accuracy - recentAccuracy) / 2),
    },
    hasPersonalBaseline: history.length > 0,
    personalPaceBaselineMs,
  };
}

// Each selection is one decision. Compare only this patient's same-activity decision times.
function selectionBaseline(input: AdaptiveSessionInput) {
  const history = input.recentSessions.filter(session => session.patientId === input.patientId &&
    session.gameType === input.telemetry.gameType && !session.isDemoSeed).slice(0, 5);
  const pace = history.length ? average(history.map(session => session.averageResponseMs)) : null;
  return {
    hasPersonalBaseline: history.length > 0,
    personalPaceBaselineMs: pace,
    relativePace: pace === null || pace <= 0 ? 0.5 : clamp01(0.5 + (pace - input.telemetry.averageResponseMs) / (2 * pace)),
    stability: history.length ? clamp01(0.5 + (input.telemetry.accuracy - average(history.map(session => session.accuracy))) / 2) : 0.5,
  };
}

export function extractPatternFeatures(input: Omit<AdaptiveSessionInput, 'telemetry'> & { telemetry: CompletedPatternTelemetry }): FeatureExtraction {
  const baseline = selectionBaseline(input), value = input.telemetry;
  return {
    hasPersonalBaseline: baseline.hasPersonalBaseline, personalPaceBaselineMs: baseline.personalPaceBaselineMs,
    features: {
      accuracy: clamp01(value.accuracy), relativePace: baseline.relativePace,
      workingMemory: value.attempts ? clamp01(1 - value.repeatedErrors / value.attempts) : 0.5,
      independence: value.challengesCompleted ? clamp01(1 - value.hintsUsed / value.challengesCompleted) : 0.5,
      stability: baseline.stability,
    },
  };
}

export function extractRoutineFeatures(input: Omit<AdaptiveSessionInput, 'telemetry'> & { telemetry: CompletedRoutineTelemetry }): FeatureExtraction {
  const baseline = selectionBaseline(input), value = input.telemetry;
  return {
    hasPersonalBaseline: baseline.hasPersonalBaseline, personalPaceBaselineMs: baseline.personalPaceBaselineMs,
    features: {
      accuracy: clamp01(value.accuracy), relativePace: baseline.relativePace,
      workingMemory: value.attempts ? clamp01((value.correctSelections - value.repeatedErrors) / value.attempts) : 0.5,
      independence: value.stepsCompleted ? clamp01(1 - value.hintsUsed / value.stepsCompleted) : 0.5,
      stability: baseline.stability,
    },
  };
}
