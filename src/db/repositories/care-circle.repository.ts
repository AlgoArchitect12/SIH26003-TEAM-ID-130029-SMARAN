import { getDatabase } from '../client';
import type { SQLiteDatabase } from 'expo-sqlite';
import { validateRecordId, ValidationError } from '../../utils/validation';
import { validateMember, type CareMember, type CareMemberInput } from '../../caregiver/care-circle';
import { parseReportFacts, type ActivityReport, type ReportRecipient, type ReportDelivery } from '../../caregiver/reports';

export function normalizePhoneNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError('Phone number is invalid.');
  let phone = value.trim().replace(/[\s()-]/gu, '');
  if (!phone) return null;
  if (/^[0-9]{10}$/.test(phone)) phone = `+91${phone}`;
  else if (/^0([0-9]{10})$/.test(phone)) phone = `+91${phone.slice(1)}`;
  else if (/^[0-9]+$/.test(phone) && phone.length >= 5 && phone.length <= 15) phone = `+${phone}`;
  if (!/^\+[1-9]\d{4,14}$/.test(phone)) throw new ValidationError('Enter a valid phone number with country code.');
  return phone;
}

export function checkCareRequest(current: () => boolean) { if (!current()) throw new Error('Care patient changed.'); }
type ReportPreference = { patient_id: string; recipient_id: string | null; frequency: 'weekly' | 'monthly'; requested: 0 | 1; consented_at: string | null; last_requested_at: string | null; delivery_status: 'not_configured' | 'pending' | 'delivered'; updated_at: string; };
async function owned(tx: SQLiteDatabase, patientId: string, current: () => boolean) {
  checkCareRequest(current);
  if (!await tx.getFirstAsync('SELECT id FROM patient_profiles WHERE id = ?', validateRecordId(patientId))) throw new Error('Missing patient.');
  checkCareRequest(current);
}
async function memberFrom(tx: SQLiteDatabase, patientId: string, id: string) {
  return tx.getFirstAsync<CareMember>('SELECT * FROM care_circle_members WHERE patient_id = ? AND id = ?', validateRecordId(patientId), validateRecordId(id));
}
async function list(patientId: string) {
  return (await getDatabase()).getAllAsync<CareMember>("SELECT * FROM care_circle_members WHERE patient_id = ? ORDER BY status, display_name, id", validateRecordId(patientId));
}
async function get(patientId: string, id: string) { return memberFrom(await getDatabase(), patientId, id); }
async function save(patientId: string, input: CareMemberInput, current: () => boolean, id?: string) {
  const value = validateMember(input);
  let saved!: CareMember;
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx, patientId, current);
    const previous = id ? await memberFrom(tx, patientId, id) : null;
    if (id && (!previous || previous.status === 'revoked')) throw new Error('Missing trusted person.');
    const recordId = id ?? (await tx.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id'))!.id;
    const now = new Date().toISOString();
    checkCareRequest(current);
    if (previous) await tx.runAsync(`UPDATE care_circle_members SET display_name=?, relationship=?, access_role=?, email=?, phone=?, scopes=?, updated_at=? WHERE patient_id=? AND id=?`,
      value.display_name, value.relationship, value.access_role, value.email, value.phone, JSON.stringify(value.scopes), now, patientId, recordId);
    else await tx.runAsync(`INSERT INTO care_circle_members(id,patient_id,display_name,relationship,access_role,email,phone,scopes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      recordId, patientId, value.display_name, value.relationship, value.access_role, value.email, value.phone, JSON.stringify(value.scopes), now, now);
    saved = (await memberFrom(tx, patientId, recordId))!;
    checkCareRequest(current);
  });
  return saved;
}
async function revoke(patientId: string, id: string, current: () => boolean) {
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx, patientId, current);
    const result = await tx.runAsync("UPDATE care_circle_members SET status='revoked', scopes='[]', email=NULL, phone=NULL, updated_at=? WHERE patient_id=? AND id=?",
      new Date().toISOString(), patientId, validateRecordId(id));
    if (!result.changes) throw new Error('Missing trusted person.');
    checkCareRequest(current);
  });
}
async function reports(patientId: string) {
  return (await getDatabase()).getAllAsync<ActivityReport>('SELECT * FROM activity_reports WHERE patient_id=? ORDER BY generated_at DESC, id DESC', validateRecordId(patientId));
}
async function report(patientId: string, id: string) {
  return (await getDatabase()).getFirstAsync<ActivityReport>('SELECT * FROM activity_reports WHERE patient_id=? AND id=?', validateRecordId(patientId), validateRecordId(id));
}
async function saveReport(patientId: string, value: Omit<ActivityReport,'id'|'patient_id'|'delivery_state'|'updated_at'>, current: () => boolean) {
  parseReportFacts(value.snapshot);
  let saved!: ActivityReport;
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx, patientId, current);
    const id = (await tx.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id'))!.id;
    checkCareRequest(current);
    await tx.runAsync(`INSERT INTO activity_reports(id,patient_id,period_start,period_end,generated_at,report_version,snapshot,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
      id, patientId, value.period_start, value.period_end, value.generated_at, value.report_version, value.snapshot, value.generated_at);
    saved = (await tx.getFirstAsync<ActivityReport>('SELECT * FROM activity_reports WHERE patient_id=? AND id=?', patientId,id))!;
    checkCareRequest(current);
  });
  return saved;
}
async function shareRequested(patientId: string, id: string, current: () => boolean) {
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx, patientId, current);
    const result = await tx.runAsync("UPDATE activity_reports SET delivery_state='share_requested',updated_at=? WHERE patient_id=? AND id=?", new Date().toISOString(), patientId, validateRecordId(id));
    if (!result.changes) throw new Error('Missing report.');
    checkCareRequest(current);
  });
}
async function recipients(patientId: string) {
  return (await getDatabase()).getAllAsync<ReportRecipient>('SELECT * FROM report_recipients WHERE patient_id=? ORDER BY created_at DESC', validateRecordId(patientId));
}
async function preference(patientId: string) {
  return (await getDatabase()).getFirstAsync<ReportPreference>('SELECT * FROM report_preferences WHERE patient_id=?', validateRecordId(patientId));
}
async function savePreference(patientId: string, recipientId: string | null, frequency: 'weekly'|'monthly', consent: boolean, current: () => boolean) {
  let saved!: ReportPreference;
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx,patientId,current);
    if (recipientId) {
      const member = await memberFrom(tx,patientId,recipientId);
      if (!member || member.status === 'revoked') throw new Error('Missing or revoked recipient.');
    }
    const now = new Date().toISOString();
    checkCareRequest(current);
    await tx.runAsync(`INSERT INTO report_preferences(patient_id,recipient_id,frequency,requested,consented_at,last_requested_at,delivery_status,updated_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(patient_id) DO UPDATE SET recipient_id=excluded.recipient_id,frequency=excluded.frequency,
      requested=excluded.requested,consented_at=excluded.consented_at,last_requested_at=excluded.last_requested_at,
      delivery_status=excluded.delivery_status,updated_at=excluded.updated_at`,
      patientId, recipientId, frequency, consent?1:0, consent?now:null, consent?now:null, 'not_configured', now);
    saved = (await tx.getFirstAsync<ReportPreference>('SELECT * FROM report_preferences WHERE patient_id=?', patientId))!;
    checkCareRequest(current);
  });
  return saved;
}
async function saveRecipient(patientId: string, careMemberId: string | null, phone: string, frequency: 'weekly'|'monthly'|'manual', consent: boolean, current: () => boolean, id?: string) {
  if (!['weekly','monthly','manual'].includes(frequency) || typeof consent !== 'boolean') throw new Error('Invalid report preference.');
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) throw new Error('A valid phone number is required for WhatsApp delivery.');

  let saved!: ReportRecipient;
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx,patientId,current);
    if (careMemberId) {
      const member = await memberFrom(tx,patientId,careMemberId);
      if (!member || member.status === 'revoked') throw new Error('Missing or revoked recipient.');
    }
    const recordId = id ?? (await tx.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id'))!.id;
    const now = new Date().toISOString();
    const consentStatus = consent ? 'enabled' : 'revoked';

    checkCareRequest(current);
    if (id) {
      await tx.runAsync(`UPDATE report_recipients SET care_member_id=?, normalized_destination=?, consent_status=?, frequency=?, updated_at=?, revoked_at=? WHERE patient_id=? AND id=?`,
        careMemberId, normalized, consentStatus, frequency, now, consent ? null : now, patientId, recordId);
    } else {
      await tx.runAsync(`INSERT INTO report_recipients(id,patient_id,care_member_id,channel,normalized_destination,consent_status,frequency,created_at,updated_at,revoked_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        recordId, patientId, careMemberId, 'whatsapp', normalized, consentStatus, frequency, now, now, consent ? null : now);
    }
    saved = (await tx.getFirstAsync<ReportRecipient>('SELECT * FROM report_recipients WHERE patient_id=? AND id=?', patientId, recordId))!;
    checkCareRequest(current);
  });
  return saved;
}
async function queueDelivery(patientId: string, recipientId: string, reportPeriod: '7-day'|'30-day'|'manual', reportStart: string, reportEnd: string, snapshotId: string, current: () => boolean) {
  let saved!: ReportDelivery;
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx, patientId, current);
    const recipient = await tx.getFirstAsync<ReportRecipient>('SELECT * FROM report_recipients WHERE patient_id=? AND id=?', patientId, recipientId);
    if (!recipient) throw new Error('Missing report recipient.');
    if (recipient.consent_status !== 'enabled') throw new Error('Recipient has not consented to delivery.');
    const snapshot = await tx.getFirstAsync<ActivityReport>('SELECT * FROM activity_reports WHERE patient_id=? AND id=?', patientId, snapshotId);
    if (!snapshot) throw new Error('Missing report snapshot.');
    const id = (await tx.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id'))!.id;
    const now = new Date().toISOString();
    checkCareRequest(current);
    await tx.runAsync(`INSERT INTO report_deliveries(id,patient_id,recipient_id,report_period,report_start,report_end,report_snapshot_id,status,queued_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,'queued',?,?,?)`, id, patientId, recipientId, reportPeriod, reportStart, reportEnd, snapshotId, now, now, now);
    saved = (await tx.getFirstAsync<ReportDelivery>('SELECT * FROM report_deliveries WHERE patient_id=? AND id=?', patientId, id))!;
    checkCareRequest(current);
  });
  return saved;
}
async function deliveries(patientId: string) {
  return (await getDatabase()).getAllAsync<ReportDelivery>('SELECT * FROM report_deliveries WHERE patient_id=? ORDER BY created_at DESC', validateRecordId(patientId));
}

export const careCircleRepository = { list, get, save, revoke, reports, report, saveReport, shareRequested, preference, savePreference, recipients, saveRecipient, queueDelivery, deliveries };
