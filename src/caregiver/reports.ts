import { CognitiveActivityTypes, type CognitiveActivityType } from '../db/schema.types';
import type { CareScope } from './care-circle';

export type ReportFacts = {
  patientName: string; days: 7 | 30; timezone: string;
  games: { gameType: CognitiveActivityType; sessions: number; attempts: number | null; correct: number | null; hints: number | null; repeatedErrors: number | null }[];
  routine: { completed: number; hydration: number; activity: number; appointment: number; unknownCategory: number; scheduledToday: number; completedToday: number };
  memories: { stored: number; added: number };
};
export type ReportTelemetry = {
  games: { gameType: CognitiveActivityType; responseTotalMs: number | null; responseAttempts: number | null; elapsedTotalMs: number | null; elapsedSessions: number }[];
};
export type ActivityReport = {
  id: string; patient_id: string; period_start: string; period_end: string; generated_at: string;
  report_version: 1; snapshot: string; delivery_state: 'generated' | 'share_requested'; updated_at: string;
};
export type ReportRecipient = {
  id: string; patient_id: string; care_member_id: string | null;
  channel: 'whatsapp'; normalized_destination: string;
  consent_status: 'enabled' | 'revoked'; frequency: 'weekly' | 'monthly' | 'manual';
  created_at: string; updated_at: string; revoked_at: string | null;
};
export type ReportDelivery = {
  id: string; patient_id: string; recipient_id: string;
  report_period: '7-day' | '30-day' | 'manual'; report_start: string; report_end: string;
  report_snapshot_id: string;
  status: 'not_configured'|'queued'|'sending'|'sent'|'delivered'|'failed'|'cancelled'|'share_requested';
  provider: 'whatsapp_business'|'manual_share'|null; provider_message_id: string | null;
  attempt_count: number; last_error: string | null;
  queued_at: string; sent_at: string | null; delivered_at: string | null; failed_at: string | null;
  created_at: string; updated_at: string;
};
export function parseReportFacts(snapshot: string): ReportFacts {
  const value = JSON.parse(snapshot) as ReportFacts;
  const exact = (object: object, keys: string[]) => object && Object.keys(object).sort().join() === [...keys].sort().join();
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  if (!exact(value, ['patientName','days','timezone','games','routine','memories']) || typeof value.patientName !== 'string' ||
      !value.patientName.trim() || value.patientName.length > 80 || ![7,30].includes(value.days) || typeof value.timezone !== 'string' || value.timezone.length > 100 ||
      // Preserve the exact historical eight-game snapshot shape as well as today's catalog.
      !Array.isArray(value.games) || ![8, CognitiveActivityTypes.length].includes(value.games.length) ||
      value.games.some((g, i) => !exact(g, ['gameType','sessions','attempts','correct','hints','repeatedErrors']) || g.gameType !== CognitiveActivityTypes[i] || !count(g.sessions) ||
        [g.attempts,g.correct,g.hints,g.repeatedErrors].some(n => n !== null && !count(n)) ||
        (g.attempts !== null && g.correct !== null && g.correct > g.attempts)) ||
      !exact(value.routine, ['completed','hydration','activity','appointment','unknownCategory','scheduledToday','completedToday']) ||
      Object.values(value.routine).some(n => !count(n)) || value.routine.completedToday > value.routine.scheduledToday ||
      value.routine.hydration + value.routine.activity + value.routine.appointment + value.routine.unknownCategory > value.routine.completed ||
      !exact(value.memories, ['stored','added']) || Object.values(value.memories).some(n => !count(n)) || value.memories.added > value.memories.stored) throw new Error('Invalid report facts.');
  // Synced snapshots must also be renderable; an invalid zone otherwise crashes the viewer.
  new Intl.DateTimeFormat('en',{timeZone:value.timezone}).format(0);
  return value;
}
export function reportTotals(facts: ReportFacts) {
  const sum = (key: 'attempts' | 'correct' | 'hints' | 'repeatedErrors') => facts.games.some(g => g.sessions > 0 && g[key] === null)
    ? null : facts.games.reduce((n,g) => n + (g[key] ?? 0), 0);
  const attempts = sum('attempts'), correct = sum('correct');
  return { sessions: facts.games.reduce((n,g) => n + g.sessions, 0), attempts, correct, hints: sum('hints'), repeatedErrors: sum('repeatedErrors'),
    accuracy: attempts !== null && attempts > 0 && correct !== null ? correct / attempts : null };
}
export function telemetryTotals(telemetry: ReportTelemetry) {
  const sum = (key: 'responseTotalMs' | 'responseAttempts' | 'elapsedTotalMs') => telemetry.games.some(g => g.elapsedSessions > 0 && g[key] === null)
    ? null : telemetry.games.reduce((n,g) => n + (g[key] ?? 0), 0);
  return {
    responseTotalMs: sum('responseTotalMs'), responseAttempts: sum('responseAttempts'),
    elapsedTotalMs: sum('elapsedTotalMs'), elapsedSessions: telemetry.games.reduce((n,g) => n + g.elapsedSessions, 0)
  };
}
// Filtering happens before rendering/export. A reports scope alone reveals no activity or memories.
export function reportAccess(scopes: readonly CareScope[]) {
  if (!scopes.includes('reports')) throw new Error('Report access is not selected.');
  return { cognitive: scopes.includes('cognitive_activity'), routine: scopes.includes('daily_activity') || scopes.includes('reminders'), memories: scopes.includes('memories') };
}
