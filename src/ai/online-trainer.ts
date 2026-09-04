import type { ActivityFeedbackLabel, AdaptiveModelState } from '@db/schema.types';

import { recommendDifficulty } from './adaptive-engine';
import type { AdaptiveFeatures } from './types';

const LEARNING_RATE = 0.05;
const FEEDBACK_TARGETS: Record<ActivityFeedbackLabel, number> = {
  easy: 0.9,
  comfortable: 0.55,
  challenging: 0.25,
};

function clampWeight(value: number) {
  return Math.min(2, Math.max(-2, value));
}

export function updateModelFromFeedback(
  model: AdaptiveModelState,
  features: AdaptiveFeatures,
  feedback: ActivityFeedbackLabel,
  updatedAt: string
): AdaptiveModelState {
  const prediction = recommendDifficulty(3, features, model).readiness;
  const adjustment = LEARNING_RATE * (FEEDBACK_TARGETS[feedback] - prediction);
  return {
    ...model,
    bias: clampWeight(model.bias + adjustment),
    weights: {
      accuracy: clampWeight(model.weights.accuracy + adjustment * features.accuracy),
      pace: clampWeight(model.weights.pace + adjustment * features.relativePace),
      memory: clampWeight(model.weights.memory + adjustment * features.workingMemory),
      hints: clampWeight(model.weights.hints + adjustment * features.independence),
      stability: clampWeight(model.weights.stability + adjustment * features.stability),
    },
    sampleCount: model.sampleCount + 1,
    updatedAt,
  };
}

/** Skipped feedback is not converted into a guessed target and performs no model update. */
export function updateModelFromOptionalFeedback(
  model: AdaptiveModelState,
  features: AdaptiveFeatures,
  feedback: ActivityFeedbackLabel | null,
  updatedAt: string
) {
  return feedback === null ? model : updateModelFromFeedback(model, features, feedback, updatedAt);
}
