import { cognitiveRepository } from '../db/repositories/cognitive.repository';
import { memoriesRepository } from '../db/repositories/memories.repository';
import { myDayRepository } from '../db/repositories/my-day.repository';
import { patientRepository } from '../db/repositories/patient.repository';
import type { CareActivity, CaregiverDashboard, UpcomingReminder } from '../caregiver/types';
import { localDateTime, localDay } from '../my-day/types';
import { validateRecordId } from '../utils/validation';

// Calendar arithmetic preserves local-day boundaries across timezone/DST changes.
export function careWindows(now: Date) {
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return { today: day(0), end: day(1), last7: day(-6), previous7: day(-13) };
}

export async function loadCaregiverDashboard(patientId: string, now = new Date()): Promise<CaregiverDashboard | null> {
  patientId = validateRecordId(patientId, 'Patient ID');
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid dashboard date');
  const patient = await patientRepository.getProfileById(patientId);
  if (!patient) return null;
  const windows = careWindows(now);
  const day = localDay(now);
  const [todayCount, last7, previous7, sessions, today, reminders, completions, events, memories] = await Promise.all([
    cognitiveRepository.countSessions(patientId, windows.today, windows.end),
    cognitiveRepository.countSessions(patientId, windows.last7, windows.end),
    cognitiveRepository.countSessions(patientId, windows.previous7, windows.last7),
    cognitiveRepository.getRecentSessions(patientId, 10),
    myDayRepository.today(patientId, now),
    myDayRepository.list(patientId),
    myDayRepository.currentCompletions(patientId, day),
    myDayRepository.recentCompletions(patientId),
    memoriesRepository.list(patientId),
  ]);
  const done = today.filter(reminder => reminder.completed).length;
  const completed = new Set(completions.map(event => event.reminderId));
  const upcoming: UpcomingReminder[] = [];
  for (const reminder of reminders) {
    if (!reminder.isEnabled || reminder.deletedAt) continue;
    let date = localDateTime(reminder.scheduledDate ?? day, reminder.timeOfDay);
    if (reminder.repeatRule === 'daily') {
      if (date < now || completed.has(reminder.id)) {
        date = localDateTime(localDay(windows.end), reminder.timeOfDay);
      }
    } else if (date < now || completed.has(reminder.id)) continue;
    if (Number.isFinite(date.getTime())) upcoming.push({ reminder, scheduledAt: date.toISOString() });
  }
  upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.reminder.id.localeCompare(b.reminder.id));
  const recentActivity: CareActivity[] = [
    ...sessions.map(session => ({ id: `session-${session.id}`, kind: 'session' as const, at: session.completedAt })),
    // Event rows do not snapshot the original reminder title/category. Do not invent them from an edited reminder.
    ...events.map(event => ({ id: `reminder-${event.id}`, kind: 'reminder' as const, at: event.completedAt })),
    ...memories.flatMap(memory => [
      { id: `created-${memory.id}`, kind: 'memoryCreated' as const, at: memory.createdAt, name: memory.name },
      ...(memory.updatedAt > memory.createdAt
        ? [{ id: `updated-${memory.id}`, kind: 'memoryUpdated' as const, at: memory.updatedAt, name: memory.name }] : []),
    ]),
  ];
  recentActivity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
  return {
    patient: { id: patient.id, preferredName: patient.preferredName }, day,
    cognitive: { today: todayCount, last7, previous7, recent: sessions.slice(0, 3) },
    routine: { today, done, pending: today.length - done },
    upcoming: upcoming.slice(0, 5), appointment: upcoming.find(item => item.reminder.type === 'appointment') ?? null,
    memories: { count: memories.length, recent: memories.slice(0, 3) },
    recentActivity: recentActivity.slice(0, 10),
  };
}
