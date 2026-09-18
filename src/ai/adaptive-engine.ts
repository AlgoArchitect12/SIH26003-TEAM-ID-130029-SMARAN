import type { AdaptiveModelState, CognitiveActivityType, DifficultyLevel } from '@db/schema.types';

import type { AdaptiveFeatures, AdaptiveRecommendation } from './types';

// Product adaptation defaults only; these values are not clinical or population norms.
export const INITIAL_MODEL_PARAMETERS = {
  bias: -1.8,
  weights: { accuracy: 1.4, pace: 0.5, memory: 0.7, hints: 0.8, stability: 0.4 },
} as const;

export function createInitialAdaptiveModel(patientId: string, gameType: CognitiveActivityType): AdaptiveModelState {
  return {
    patientId,
    gameType,
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
  let change = readiness < 0.35 ? -1 : readiness > 0.75 ? 1 : 0;
  // Patient failing multiple times (e.g. 3x) on Level 1 must not be promoted.
  if (currentDifficulty === 1 && features.accuracy <= 0.65 && change > 0) {
    change = 0;
  }
  const recommendedDifficulty = clampDifficulty(currentDifficulty + change);
  // Explain the actual bounded change, including level 1 and level 5.
  const direction = recommendedDifficulty < currentDifficulty ? 'gentler' : recommendedDifficulty > currentDifficulty ? 'challenge' : 'hold';

  return {
    contributions,
    direction,
    readiness,
    recommendedDifficulty,
  };
}
