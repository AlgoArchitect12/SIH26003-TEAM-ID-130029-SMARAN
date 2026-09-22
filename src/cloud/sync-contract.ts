import { SYNC_COLUMNS as SYNC_COLUMNS_V1, type SyncEntity } from './location-sync-columns';
import { validateLocation, type PatientLocation } from '../location/types';
import { validateMember, parseScopes } from '../caregiver/care-circle';
import { parseReportFacts } from '../caregiver/reports';
import { CognitiveActivityTypes, type AgeBracket } from '../db/schema.types';
import { validateCreatePatientProfile } from '../utils/validation';

export const BATCH_SIZE = 25;
export type CloudRecord = {
  owner_id: string; patient_id: string; entity_type: SyncEntity; entity_id: string;
  payload: Record<string, string | number | null>; deleted: boolean; version: number;
};
export type PullBatch = { records: CloudRecord[]; parents: CloudRecord[]; cursor: number; has_more: boolean };
export type OutboxEvent = {
  sequence: number; mutation_id: string; owner_id: string; patient_id: string; entity_type: SyncEntity;
  entity_id: string; operation: 'upsert' | 'delete'; payload: string; attempts: number;
  next_attempt_at: number; state: 'pending' | 'failed';
};
export type PushReceipt = { mutation_id: string; status: 'applied' | 'duplicate' | 'rejected'; error?: 'invalid' | 'conflict' | 'server' };

export function assertOwner(owner: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) throw new Error('Invalid cloud account.');
}
export function validateCloudRecord(value: unknown, owner: string): CloudRecord {
  if (!value || typeof value !== 'object') throw new Error('Invalid sync record.');
  const r = value as CloudRecord;
  const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  if (r.owner_id !== owner || !id(r.patient_id) || !Object.hasOwn(SYNC_COLUMNS_V1, r.entity_type) ||
      typeof r.entity_id !== 'string' || r.entity_id.length > 256 || !Number.isSafeInteger(r.version) || r.version < 1 ||
      typeof r.deleted !== 'boolean' || !r.payload || typeof r.payload !== 'object' || Array.isArray(r.payload) ||
      new TextEncoder().encode(JSON.stringify(r.payload)).length > 16384) throw new Error('Invalid sync record.');
  if (r.deleted) {
    if (r.entity_type !== 'personal_memories' || !id(r.entity_id) || Object.keys(r.payload).length) throw new Error('Invalid deletion.');
    return r;
  }
  const columns: readonly string[] = SYNC_COLUMNS_V1[r.entity_type];
  if (Object.keys(r.payload).length !== columns.length || columns.some(column => !Object.hasOwn(r.payload, column)) ||
      Object.values(r.payload).some(value => value !== null && typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value)))) {
    throw new Error('Invalid sync fields.');
  }
  const p = r.payload;
  if (r.entity_type === 'patient_locations') validateLocation(p as unknown as PatientLocation);
  if (r.entity_type === 'care_circle_members') {
    const scopes = parseScopes(String(p.scopes));
    validateMember({ display_name: p.display_name as string, relationship: p.relationship as string,
      access_role: p.access_role as 'family', email: p.email as string | null, phone: p.phone as string | null, scopes });
    if (!['local','revoked'].includes(String(p.status)) || (p.status === 'revoked' && scopes.length)) throw new Error('Invalid care status.');
  }
  if (r.entity_type === 'activity_reports') {
    parseReportFacts(String(p.snapshot));
    if (p.report_version !== 1 || !['generated','share_requested'].includes(String(p.delivery_state)) ||
        typeof p.period_start !== 'string' || typeof p.period_end !== 'string' || !Number.isFinite(Date.parse(p.period_start)) ||
        !Number.isFinite(Date.parse(p.period_end)) || p.period_start >= p.period_end) throw new Error('Invalid report.');
  }
  if (r.entity_type === 'report_preferences' && (!['weekly','monthly'].includes(String(p.frequency)) ||
      ![0,1].includes(Number(p.requested)) || typeof p.requested !== 'number' || p.delivery_status !== 'not_configured' ||
      (p.recipient_id !== null && !id(p.recipient_id)) || (p.requested === 1 && (!p.recipient_id || !p.consented_at || !p.last_requested_at)))) throw new Error('Invalid delivery preference.');
  if (r.entity_type === 'report_recipients') {
    if ((p.care_member_id !== null && !id(p.care_member_id)) || p.channel !== 'whatsapp' ||
        typeof p.normalized_destination !== 'string' || p.normalized_destination.length < 5 || p.normalized_destination.length > 32 ||
        !['enabled','revoked'].includes(String(p.consent_status)) || !['weekly','monthly','manual'].includes(String(p.frequency)) ||
        (p.consent_status !== 'enabled' && p.revoked_at === null)) throw new Error('Invalid report recipient.');
  }
  if (r.entity_type === 'report_deliveries') {
    if (!id(p.recipient_id) || !['7-day','30-day','manual'].includes(String(p.report_period)) ||
        typeof p.report_start !== 'string' || typeof p.report_end !== 'string' || !Number.isFinite(Date.parse(p.report_start)) ||
        !Number.isFinite(Date.parse(p.report_end)) || p.report_start >= p.report_end || !id(p.report_snapshot_id) ||
        !['not_configured','queued','sending','sent','delivered','failed','cancelled','share_requested'].includes(String(p.status)) ||
        (p.provider !== null && !['whatsapp_business','manual_share'].includes(String(p.provider))) ||
        (p.provider_message_id !== null && typeof p.provider_message_id !== 'string') ||
        typeof p.attempt_count !== 'number' || p.attempt_count < 0 ||
        (p.last_error !== null && typeof p.last_error !== 'string') ||
        typeof p.queued_at !== 'string' || !Number.isFinite(Date.parse(p.queued_at))) throw new Error('Invalid report delivery.');
  }
  if (r.entity_type === 'patient_profiles') validateCreatePatientProfile({ id: String(p.id), preferredName: p.preferred_name as string,
    ageBracket: p.age_bracket as AgeBracket | null, emergencyName: p.emergency_name as string | null, emergencyPhone: p.emergency_phone as string | null });
  if (r.entity_type === 'adaptive_model_state') {
    if (!Number.isSafeInteger(p.sample_count) || Number(p.sample_count) < 0 ||
        ['bias', 'weight_accuracy', 'weight_pace', 'weight_memory', 'weight_hints', 'weight_stability'].some(key => typeof p[key] !== 'number' || Number(p[key]) < -2 || Number(p[key]) > 2)) {
      throw new Error('Invalid adaptive model.');
    }
  }
  if ((r.entity_type === 'patient_profiles' ? p.id : p.patient_id) !== r.patient_id) throw new Error('Invalid patient ownership.');
  const expectedId = ['patient_settings', 'report_preferences'].includes(r.entity_type) ? r.patient_id
    : r.entity_type === 'adaptive_model_state' ? `${r.patient_id}:${p.game_type}`
      : r.entity_type === 'reminder_events' ? `${p.reminder_id}:${String(p.scheduled_for).slice(0, 10)}` : p.id;
  if (r.entity_id !== expectedId || ('id' in p && !id(p.id)) || ('reminder_id' in p && !id(p.reminder_id))) throw new Error('Invalid entity identity.');
  if ('game_type' in p && !CognitiveActivityTypes.includes(p.game_type as typeof CognitiveActivityTypes[number])) throw new Error('Invalid activity.');
  // Domain constraints remain enforced by SQLite; protect timestamps/numeric/text shape before SQL binding.
  for (const [column, item] of Object.entries(p)) {
    if (column.endsWith('_at') && item !== null && (typeof item !== 'string' || !Number.isFinite(Date.parse(item)))) throw new Error('Invalid timestamp.');
    if (typeof item === 'string' && new TextEncoder().encode(item).length > (r.entity_type === 'activity_reports' && column === 'snapshot' ? 12000 : 2048)) throw new Error('Invalid text size.');
  }
  return r;
}
