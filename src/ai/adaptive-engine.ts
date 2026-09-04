import type { AdaptiveModelState, DifficultyLevel } from '@db/schema.types';

import type { AdaptiveFeatures, AdaptiveRecommendation } from './types';

// Product adaptation defaults only; these values are not clinical or population norms.
export const INITIAL_MODEL_PARAMETERS = {
  bias: -1.8,
  weights: { accuracy: 1.4, pace: 0.5, memory: 0.7, hints: 0.8, stability: 0.4 },
} as const;

export function createInitialAdaptiveModel(patientId: string): AdaptiveModelState {
  return {
    patientId,
    bias: INITIAL_MODEL_PARAMETERS.bias,
    weights: { ...INITIAL_MODEL_PARAMETERS.weights },
    sampleCount: 0,
    updatedAt: '',
  };
}

export function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function clampDifficulty(value: number): DifficultyLevel {
  return Math.min(5, Math.max(1, value)) as DifficultyLevel;
}

export function recommendDifficulty(
  currentDifficulty: DifficultyLevel,
  features: AdaptiveFeatures,
  model: AdaptiveModelState
): AdaptiveRecommendation {
  const contributions = {
    accuracy: model.weights.accuracy * features.accuracy,
    relativePace: model.weights.pace * features.relativePace,
    workingMemory: model.weights.memory * features.workingMemory,
    independence: model.weights.hints * features.independence,
    stability: model.weights.stability * features.stability,
  };
  const readiness = sigmoid(
    model.bias + Object.values(contributions).reduce((sum, value) => sum + value, 0)
  );
  const direction = readiness < 0.35 ? 'gentler' : readiness > 0.75 ? 'challenge' : 'hold';
  const change = direction === 'gentler' ? -1 : direction === 'challenge' ? 1 : 0;

  return {
    contributions,
    direction,
    readiness,
    recommendedDifficulty: clampDifficulty(currentDifficulty + change),
  };
}
