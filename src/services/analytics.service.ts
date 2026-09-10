import { cognitiveRepository, type AnalyticsAggregate, type AnalyticsCursor } from '../db/repositories/cognitive.repository';
import { CognitiveActivityTypes } from '../db/schema.types';
import { resolveActivePatient } from './active-patient.service';
import { capturePatientRequest } from '../stores/patient-session.store';

export type AnalyticsDays = 1 | 7 | 30;

export function analyticsWindow(days: AnalyticsDays, now = new Date()) {
  if (![1, 7, 30].includes(days) || !Number.isFinite(now.getTime())) throw new Error('Invalid analytics window.');
  // Same local calendar convention as careWindows; never subtract fixed 24-hour durations.
  const boundaries = Array.from({ length: days + 1 }, (_, index) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1 + index).toISOString());
  return { days, boundaries, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, asOf: now.toISOString() };
}

const ratio = (numerator: number | null, denominator: number | null) =>
  numerator !== null && denominator !== null && denominator > 0 && Number.isFinite(numerator / denominator)
    ? numerator / denominator : null;

function metrics(row: AnalyticsAggregate) {
  return { ...row, accuracy: ratio(row.correct, row.attempts),
    averageResponseMs: ratio(row.responseTotalMs, row.responseAttempts),
    averageElapsedMs: ratio(row.elapsedTotalMs, row.elapsedSessions) };
}

export async function loadAnalyticsSummary(patientId: string, days: AnalyticsDays, now = new Date()) {
  const window = analyticsWindow(days, now);
  const rows = await cognitiveRepository.getAnalyticsSummary(patientId, window.boundaries);
  return { window, games: CognitiveActivityTypes.map(gameType => ({ gameType,
    summary: rows.filter(row => row.gameType === gameType && row.difficulty === null).map(metrics)[0] ?? null,
    levels: rows.filter(row => row.gameType === gameType && row.difficulty !== null).map(metrics),
  })) };
}

export async function loadAnalyticsHistory(patientId: string, cursor?: AnalyticsCursor, limit = 20) {
  const rows = await cognitiveRepository.getAnalyticsHistory(patientId, cursor, limit);
  const sessions = rows.slice(0, limit);
  const last = sessions[sessions.length - 1];
  return { sessions, next: rows.length > limit && last
    ? { patientId, completedAt: last.completedAt, id: last.id, ceiling: last.ceiling } : null };
}

export class AnalyticsPatientChanged extends Error {}

// Local shared-device context, not remote authentication. No URL patient ID is accepted.
// Recheck after asynchronous reads so a switched profile cannot receive an old response.
export async function loadActiveAnalytics(days: AnalyticsDays, cursor?: AnalyticsCursor) {
  const isCurrent = capturePatientRequest();
  const active = await resolveActivePatient();
  if (active.status !== 'ready') return null;
  if (cursor && cursor.patientId !== active.profile.id) throw new AnalyticsPatientChanged();
  const [summary, history] = await Promise.all([
    loadAnalyticsSummary(active.profile.id, days),
    loadAnalyticsHistory(active.profile.id, cursor),
  ]);
  const current = await resolveActivePatient();
  if (!isCurrent() || current.status !== 'ready' || current.profile.id !== active.profile.id) throw new AnalyticsPatientChanged();
  return { patient: { id: active.profile.id, name: active.profile.preferredName }, settings: active.settings, summary, history };
}

export type AnalyticsSummary = Awaited<ReturnType<typeof loadAnalyticsSummary>>;
export type AnalyticsHistory = Awaited<ReturnType<typeof loadAnalyticsHistory>>;
