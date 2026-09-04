import type {
  ActivityFeedbackLabel,
  AdaptiveModelState,
  CognitiveSession,
  DifficultyLevel,
} from '@db/schema.types';
import type { CompletedMemoryTelemetry } from '@/src/games/memory-match/telemetry';

export type AdaptiveFeatures = {
  accuracy: number;
  relativePace: number;
  workingMemory: number;
  independence: number;
  stability: number;
};

export type FeatureExtraction = {
  features: AdaptiveFeatures;
  hasPersonalBaseline: boolean;
  personalPaceBaselineMs: number | null;
};

export type AdaptiveDirection = 'gentler' | 'hold' | 'challenge';

export type AdaptiveRecommendation = {
  contributions: AdaptiveFeatures;
  direction: AdaptiveDirection;
  readiness: number;
  recommendedDifficulty: DifficultyLevel;
};

export type AdaptiveSessionInput = {
  currentDifficulty: DifficultyLevel;
  patientId: string;
  recentSessions: readonly CognitiveSession[];
  telemetry: CompletedMemoryTelemetry;
};

export type PendingCognitiveSession = {
  extraction: FeatureExtraction;
  initialRecommendation: AdaptiveRecommendation;
  model: AdaptiveModelState;
  patientId: string;
  telemetry: CompletedMemoryTelemetry;
  currentDifficulty: DifficultyLevel;
};

export type SavedCognitiveResult = {
  feedback: ActivityFeedbackLabel | null;
  recommendation: AdaptiveRecommendation;
  session: CognitiveSession;
};
