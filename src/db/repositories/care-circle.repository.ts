import { getDatabase } from '../client';
import type { SQLiteDatabase } from 'expo-sqlite';
import { validateRecordId } from '../../utils/validation';
import { effectiveScopes, validateMember, type CareMember, type CareMemberInput } from '../../caregiver/care-circle';
import { parseReportFacts, type ActivityReport, type ReportPreference } from '../../caregiver/reports';

export function checkCareRequest(current: () => boolean) { if (!current()) throw new Error('Care patient changed.'); }
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
async function preference(patientId: string) {
  return (await getDatabase()).getFirstAsync<ReportPreference>('SELECT * FROM report_preferences WHERE patient_id=?',validateRecordId(patientId));
}
async function savePreference(patientId: string, recipientId: string | null, frequency: 'weekly'|'monthly', consent: boolean, current: () => boolean) {
  if (!['weekly','monthly'].includes(frequency) || typeof consent !== 'boolean') throw new Error('Invalid report preference.');
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    await owned(tx,patientId,current);
    const member = recipientId ? await memberFrom(tx,patientId,recipientId) : null;
    if (recipientId && (!member || member.status === 'revoked')) throw new Error('Missing recipient.');
    if (consent && (!member?.email || !effectiveScopes(member).includes('reports'))) throw new Error('Select a report recipient and give consent.');
    const now = new Date().toISOString();
    checkCareRequest(current);
    await tx.runAsync(`INSERT INTO report_preferences(patient_id,recipient_id,frequency,requested,consented_at,last_requested_at,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(patient_id) DO UPDATE SET recipient_id=excluded.recipient_id,frequency=excluded.frequency,requested=excluded.requested,
      consented_at=excluded.consented_at,last_requested_at=excluded.last_requested_at,updated_at=excluded.updated_at`,
      patientId, recipientId, frequency, Number(consent), consent ? now : null, consent ? now : null, now);
    checkCareRequest(current);
  });
}
export const careCircleRepository = { list, get, save, revoke, reports, report, saveReport, shareRequested, preference, savePreference };
