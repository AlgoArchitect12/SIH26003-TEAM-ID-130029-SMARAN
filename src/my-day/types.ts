export const ReminderTypes = ['medicine', 'hydration', 'activity', 'appointment', 'custom'] as const;
export type ReminderType = (typeof ReminderTypes)[number];
export type ReminderInput = {
  type: ReminderType;
  title: string;
  note: string;
  timeOfDay: string;
  scheduledDate: string | null;
  repeatRule: 'daily' | 'once';
};
export type Reminder = ReminderInput & {
  id: string;
  patientId: string;
  isEnabled: boolean;
  notificationId: string | null;
  revision: number;
  notificationRevision: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ReminderEvent = {
  id: number;
  reminderId: string;
  patientId: string;
  scheduledFor: string;
  status: 'completed';
  completedAt: string;
  createdAt: string;
};
export type TodayReminder = Reminder & { completed: boolean };

export class MyDayError extends Error {
  constructor(public readonly code: 'invalid' | 'missing' | 'limit' | 'past') { super(code); }
}

export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function localDateTime(day: string, time: string) {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hour, minute, 0, 0);
}

export function validateReminder(input: ReminderInput): ReminderInput {
  if (!ReminderTypes.includes(input.type) || typeof input.title !== 'string' || typeof input.note !== 'string' ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(input.timeOfDay)) throw new MyDayError('invalid');
  const title = input.title.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const note = input.note.normalize('NFC').trim();
  if (!title || title.length > 120 || note.length > 300 || /[\u0000-\u0008\u000b-\u001f]/u.test(title + note)) throw new MyDayError('invalid');
  if (input.repeatRule === 'daily') {
    if (input.scheduledDate !== null) throw new MyDayError('invalid');
  } else if (input.repeatRule === 'once') {
    const day = input.scheduledDate;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(day) ||
        day < '2000-01-01' || day > '2100-12-31' || localDay(localDateTime(day, '12:00')) !== day) throw new MyDayError('invalid');
    const date = localDateTime(day, input.timeOfDay);
    if (date.getHours() !== Number(input.timeOfDay.slice(0,2)) || date.getMinutes() !== Number(input.timeOfDay.slice(3))) throw new MyDayError('invalid');
  } else throw new MyDayError('invalid');
  return { ...input, title, note };
}

export function timeLabel(language: string, time: string) {
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(localDateTime('2026-01-01', time));
}
