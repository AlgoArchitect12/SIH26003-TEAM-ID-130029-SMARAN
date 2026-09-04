import type { AdaptiveSessionInput, FeatureExtraction } from './types';

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
  // Repository queries are patient-scoped; this additional filter keeps the pure boundary verifiable.
  const history = input.recentSessions
    .filter((session) => session.patientId === input.patientId && !session.isDemoSeed)
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
