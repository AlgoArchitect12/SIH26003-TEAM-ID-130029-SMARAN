import { createInitialAdaptiveModel, recommendDifficulty } from '../ai/adaptive-engine';
import { updateModelFromOptionalFeedback } from '../ai/online-trainer';
import type { PendingCognitiveSession, SavedCognitiveResult } from '../ai/types';
import { cognitiveRepository } from '../db/repositories/cognitive.repository';
import type { ActivityFeedbackLabel, CompletedSessionInput } from '../db/schema.types';
import { activityMetrics } from '../games/telemetry';
import { capturePatientRequest } from '../stores/patient-session.store';
import { resolveActivePatient } from './active-patient.service';

export function completedSessionInput(pending: PendingCognitiveSession, feedback: ActivityFeedbackLabel | null,
  recommendedDifficulty: CompletedSessionInput['recommendedDifficulty']): CompletedSessionInput {
  const value = pending.telemetry;
  return {
    ...activityMetrics(value), accuracy: value.accuracy, attempts: value.attempts,
    averageResponseMs: value.averageResponseMs, hintsUsed: value.hintsUsed,
    startedAt: new Date(value.startedAtMs).toISOString(), completedAt: new Date(value.completedAtMs).toISOString(),
    patientId: pending.patientId, difficulty: pending.currentDifficulty, feedbackLabel: feedback, recommendedDifficulty,
  };
}

export async function saveCognitiveResult(pending: PendingCognitiveSession, feedback: ActivityFeedbackLabel | null): Promise<SavedCognitiveResult> {
  const isCurrent = capturePatientRequest();
  const active = await resolveActivePatient();
  if (!isCurrent() || active.status !== 'ready' || active.profile.id !== pending.patientId) {
    throw new Error('Activity patient changed before saving.');
  }
  if (pending.model.patientId !== pending.patientId || pending.model.gameType !== pending.telemetry.gameType) {
    throw new Error('Activity model does not match the completed session.');
  }
  const [storedModel, recent] = await Promise.all([
    cognitiveRepository.getAdaptiveModel(pending.patientId, pending.telemetry.gameType),
    cognitiveRepository.getRecentSessions(pending.patientId, 1, pending.telemetry.gameType),
  ]);
  if (!isCurrent()) throw new Error('Activity patient changed before saving.');

  if (recent[0] && Date.parse(recent[0].completedAt) > pending.telemetry.completedAtMs) {
    throw new Error('A newer activity has already been saved.');
  }
  const model = updateModelFromOptionalFeedback(storedModel ?? createInitialAdaptiveModel(pending.patientId, pending.telemetry.gameType), pending.extraction.features, feedback, new Date(pending.telemetry.completedAtMs).toISOString());
  const recommendation = recommendDifficulty(pending.currentDifficulty, pending.extraction.features, model);
  const session = await cognitiveRepository.saveCompletedSession(
    completedSessionInput(pending, feedback, recommendation.recommendedDifficulty), feedback === null ? undefined : model, isCurrent, recent[0]?.id ?? null
  );
  return { feedback, recommendation, session };
}
