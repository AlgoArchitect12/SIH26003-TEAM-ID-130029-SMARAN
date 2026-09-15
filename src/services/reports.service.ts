import { getDatabase } from '../db/client';
import { careCircleRepository as repo, checkCareRequest } from '../db/repositories/care-circle.repository';
import { myDayRepository } from '../db/repositories/my-day.repository';
import { patientRepository } from '../db/repositories/patient.repository';
import { loadAnalyticsSummary } from './analytics.service';
import type { ReportFacts } from '../caregiver/reports';
import { validateRecordId } from '../utils/validation';

export async function loadReportFacts(patientId: string, days: 7 | 30, now = new Date()) {
  patientId = validateRecordId(patientId);
  const summary = await loadAnalyticsSummary(patientId, days, now);
  const start = summary.window.boundaries[0], end = summary.window.boundaries.at(-1)!;
  const db = await getDatabase();
  const [patient, today, routine, memories] = await Promise.all([
    patientRepository.getProfileById(patientId), myDayRepository.today(patientId, now),
    // An edited reminder cannot prove an older event's category. Exclude those events
    // from category totals, while retaining their factual completion count.
    db.getFirstAsync<{ completed: number; hydration: number; activity: number; appointment: number; unknownCategory: number }>(`SELECT count(*) AS completed,
      coalesce(sum(r.type='hydration' AND r.updated_at <= e.completed_at),0) AS hydration,
      coalesce(sum(r.type='activity' AND r.updated_at <= e.completed_at),0) AS activity,
      coalesce(sum(r.type='appointment' AND r.updated_at <= e.completed_at),0) AS appointment,
      coalesce(sum(r.id IS NULL OR r.updated_at > e.completed_at),0) AS unknownCategory
      FROM reminder_events e LEFT JOIN reminders r ON r.patient_id=e.patient_id AND r.id=e.reminder_id
      WHERE e.patient_id=? AND e.status='completed' AND e.completed_at>=? AND e.completed_at<?`,patientId,start,end),
    db.getFirstAsync<{ stored: number; added: number }>(`SELECT count(*) AS stored, coalesce(sum(created_at>=? AND created_at<?),0) AS added
      FROM personal_memories WHERE patient_id=?`,start,end,patientId),
  ]);
  if (!patient) throw new Error('Missing patient.');
  const facts: ReportFacts = { patientName: patient.preferredName, days, timezone: summary.window.timezone,
    games: summary.games.map(({gameType,summary: row}) => ({gameType,sessions:row?.sessions ?? 0,attempts:row?.attempts ?? null,
      correct:row?.correct ?? null,hints:row?.hints ?? null,repeatedErrors:row?.repeatedErrors ?? null})),
    routine: {...routine!,scheduledToday:today.length,completedToday:today.filter(r=>r.completed).length}, memories:memories! };
  return { facts, start, end, generatedAt: now.toISOString() };
}
export async function generateActivityReport(patientId: string, days: 7|30, current: () => boolean, now = new Date()) {
  checkCareRequest(current);
  const value = await loadReportFacts(patientId, days, now);
  checkCareRequest(current);
  return repo.saveReport(patientId, {period_start:value.start,period_end:value.end,generated_at:value.generatedAt,
    report_version:1,snapshot:JSON.stringify(value.facts)},current);
}
