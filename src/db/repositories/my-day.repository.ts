import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../client';
import { validateRecordId } from '../../utils/validation';
import { localDay, MyDayError, validateReminder, type Reminder, type ReminderEvent, type ReminderInput, type TodayReminder } from '../../my-day/types';

type Row = Omit<Reminder, 'isEnabled'> & { isEnabled: number };
const map = (row: Row): Reminder => ({ ...row, isEnabled: row.isEnabled === 1 });

function checkCurrent(isCurrent?: () => boolean) {
  if (isCurrent && !isCurrent()) throw new Error('Reminder patient changed before saving.');
}

async function getFrom(db: SQLiteDatabase, patientId: string, id: string) {
  const row = await db.getFirstAsync<Row>(
    `SELECT id, patient_id AS patientId, type, title, note, time_of_day AS timeOfDay,
  scheduled_date AS scheduledDate, repeat_rule AS repeatRule, is_enabled AS isEnabled,
  notification_id AS notificationId, revision, notification_revision AS notificationRevision,
  deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt FROM reminders WHERE patient_id = ? AND id = ?`,
    validateRecordId(patientId), validateRecordId(id));
  return row ? map(row) : null;
}
async function get(patientId: string, id: string) { return getFrom(await getDatabase(), patientId, id); }
async function list(patientId: string, includeRemoved = false) {
  const rows = await (await getDatabase()).getAllAsync<Row>(
    `SELECT id, patient_id AS patientId, type, title, note, time_of_day AS timeOfDay,
  scheduled_date AS scheduledDate, repeat_rule AS repeatRule, is_enabled AS isEnabled,
  notification_id AS notificationId, revision, notification_revision AS notificationRevision,
  deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt FROM reminders WHERE patient_id = ? AND (? = 1 OR deleted_at IS NULL) ORDER BY time_of_day, created_at`,
    validateRecordId(patientId), Number(includeRemoved));
  return rows.map(map);
}
async function capacity(db: SQLiteDatabase, patientId: string, excluding: string) {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) AS count FROM reminders WHERE patient_id = ? AND id != ? AND is_enabled = 1 AND deleted_at IS NULL', patientId, excluding);
  // ponytail: 50 enabled reminders leaves room under iOS pending-notification limits; revisit with a native scheduling strategy if needed.
  if ((row?.count ?? 0) >= 50) throw new MyDayError('limit');
}
async function save(patientId: string, input: ReminderInput, id?: string, isCurrent?: () => boolean) {
  checkCurrent(isCurrent);
  patientId = validateRecordId(patientId);
  const value = validateReminder(input);
  const db = await getDatabase();
  let recordId = id ? validateRecordId(id) : '';
  await db.withExclusiveTransactionAsync(async tx => {
    checkCurrent(isCurrent);
    const current = recordId ? await getFrom(tx, patientId, recordId) : null;
    if (recordId && (!current || current.deletedAt)) throw new MyDayError('missing');
    if (!current || current.isEnabled) await capacity(tx, patientId, recordId);
    checkCurrent(isCurrent);
    const now = new Date().toISOString();
    if (current) {
      await tx.runAsync(`UPDATE reminders SET type = ?, title = ?, note = ?, time_of_day = ?, scheduled_date = ?,
        repeat_rule = ?, revision = revision + 1, updated_at = ? WHERE patient_id = ? AND id = ?`,
        value.type, value.title, value.note, value.timeOfDay, value.scheduledDate, value.repeatRule, now, patientId, recordId);
    } else {
      const generated = await tx.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id');
      if (!generated) throw new Error('Could not generate reminder ID');
      recordId = generated.id;
      checkCurrent(isCurrent);
      await tx.runAsync(`INSERT INTO reminders (id, patient_id, type, title, note, time_of_day, scheduled_date, repeat_rule, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, recordId, patientId, value.type, value.title, value.note,
        value.timeOfDay, value.scheduledDate, value.repeatRule, now, now);
    }
    checkCurrent(isCurrent);
  });
  const saved = await get(patientId, recordId);
  if (!saved) throw new MyDayError('missing');
  return saved;
}
async function setEnabled(patientId: string, id: string, enabled: boolean, isCurrent?: () => boolean) {
  checkCurrent(isCurrent);
  if (typeof enabled !== 'boolean') throw new MyDayError('invalid');
  patientId = validateRecordId(patientId); id = validateRecordId(id);
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    checkCurrent(isCurrent);
    const current = await getFrom(tx, patientId, id);
    if (!current || current.deletedAt) throw new MyDayError('missing');
    if (enabled) await capacity(tx, patientId, id);
    checkCurrent(isCurrent);
    await tx.runAsync('UPDATE reminders SET is_enabled = ?, revision = revision + 1, updated_at = ? WHERE patient_id = ? AND id = ?',
      Number(enabled), new Date().toISOString(), patientId, id);
    checkCurrent(isCurrent);
  });
}
async function remove(patientId: string, id: string, isCurrent?: () => boolean) {
  checkCurrent(isCurrent);
  const now = new Date().toISOString();
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    checkCurrent(isCurrent);
    const result = await tx.runAsync(`UPDATE reminders SET is_enabled = 0, deleted_at = ?,
      revision = revision + 1, updated_at = ? WHERE patient_id = ? AND id = ? AND deleted_at IS NULL`,
      now, now, validateRecordId(patientId), validateRecordId(id));
    if (!result.changes) throw new MyDayError('missing');
    checkCurrent(isCurrent);
  });
}
async function history(patientId: string, reminderId?: string, day?: string) {
  const recordId = reminderId === undefined ? null : validateRecordId(reminderId);
  return (await getDatabase()).getAllAsync<ReminderEvent>(`SELECT id, reminder_id AS reminderId, patient_id AS patientId,
    scheduled_for AS scheduledFor, status, completed_at AS completedAt, created_at AS createdAt
    FROM reminder_events WHERE patient_id = ? AND (? IS NULL OR reminder_id = ?) AND (? IS NULL OR (scheduled_for >= ? AND scheduled_for < ?)) ORDER BY scheduled_for DESC`,
    validateRecordId(patientId), recordId, recordId, day ?? null, day ?? null, day ? day + 'U' : null);
}
async function currentCompletions(patientId: string, day = localDay()) {
  return (await getDatabase()).getAllAsync<ReminderEvent>(`SELECT e.id, e.reminder_id AS reminderId, e.patient_id AS patientId,
    e.scheduled_for AS scheduledFor, e.status, e.completed_at AS completedAt, e.created_at AS createdAt
    FROM reminder_events e JOIN reminders r ON r.id = e.reminder_id AND r.patient_id = e.patient_id
    WHERE e.patient_id = ? AND r.deleted_at IS NULL AND
      ((r.repeat_rule = 'daily' AND e.scheduled_for >= ? AND e.scheduled_for < ?) OR
       (r.repeat_rule = 'once' AND substr(e.scheduled_for,1,10) = r.scheduled_date))`,
    validateRecordId(patientId), day, day + 'U');
}
async function today(patientId: string, now = new Date()): Promise<TodayReminder[]> {
  const day = localDay(now);
  const [reminders, events] = await Promise.all([list(patientId), history(patientId, undefined, day)]);
  const done = new Set(events.filter(event => event.scheduledFor.slice(0,10) === day).map(event => event.reminderId));
  return reminders.filter(r => r.isEnabled && (r.repeatRule === 'daily' || r.scheduledDate === day))
    .map(r => ({ ...r, completed: done.has(r.id) }));
}
async function complete(patientId: string, id: string, day: string, isCurrent?: () => boolean) {
  checkCurrent(isCurrent);
  patientId = validateRecordId(patientId); id = validateRecordId(id);
  if (day !== localDay()) throw new MyDayError('invalid');
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    checkCurrent(isCurrent);
    const reminder = await getFrom(tx, patientId, id);
    if (!reminder || reminder.deletedAt || !reminder.isEnabled ||
        (reminder.repeatRule === 'once' && reminder.scheduledDate !== day)) throw new MyDayError('missing');
    checkCurrent(isCurrent);
    const now = new Date().toISOString();
    await tx.runAsync(`INSERT INTO reminder_events (reminder_id, patient_id, scheduled_for, status, completed_at, created_at)
      VALUES (?, ?, ?, 'completed', ?, ?) ON CONFLICT DO NOTHING`, id, patientId, `${day}T${reminder.timeOfDay}`, now, now);
    checkCurrent(isCurrent);
  });
}
async function acknowledgeNotification(reminder: Reminder, notificationId: string | null) {
  const result = await (await getDatabase()).runAsync(`UPDATE reminders SET notification_id = ?, notification_revision = ?
    WHERE patient_id = ? AND id = ? AND revision = ?`, notificationId, reminder.revision,
    validateRecordId(reminder.patientId), validateRecordId(reminder.id), reminder.revision);
  return result.changes === 1;
}
async function recentCompletions(patientId: string) {
  return (await getDatabase()).getAllAsync<ReminderEvent>(`SELECT e.id, e.reminder_id AS reminderId, e.patient_id AS patientId,
    e.scheduled_for AS scheduledFor, e.status, e.completed_at AS completedAt, e.created_at AS createdAt
    FROM reminder_events e JOIN reminders r ON r.id = e.reminder_id AND r.patient_id = e.patient_id
    WHERE e.patient_id = ? AND e.status = 'completed' ORDER BY e.completed_at DESC, e.id DESC LIMIT 10`,
    validateRecordId(patientId));
}
export const myDayRepository = { get, list, save, setEnabled, remove, today, complete, history, currentCompletions, acknowledgeNotification, recentCompletions };
