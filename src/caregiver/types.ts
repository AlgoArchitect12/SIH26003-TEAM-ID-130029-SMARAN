import type { CognitiveSession, PatientProfile } from '../db/schema.types';
import type { PersonalMemory } from '../memories/types';
import type { Reminder, TodayReminder } from '../my-day/types';

export type UpcomingReminder = { reminder: Reminder; scheduledAt: string };
export type CareActivity = {
  id: string;
  kind: 'session' | 'reminder' | 'memoryCreated' | 'memoryUpdated';
  at: string;
  name?: string;
};
export type CaregiverDashboard = {
  patient: Pick<PatientProfile, 'id' | 'preferredName'>;
  day: string;
  cognitive: { today: number; last7: number; previous7: number; recent: CognitiveSession[] };
  routine: { today: TodayReminder[]; done: number; pending: number };
  upcoming: UpcomingReminder[];
  appointment: UpcomingReminder | null;
  memories: { count: number; recent: PersonalMemory[] };
  recentActivity: CareActivity[];
};
