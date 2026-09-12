import { SYNC_COLUMNS_V1, type SyncEntity } from '../db/migrations/008_auth_sync';
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
  if (r.entity_type === 'patient_profiles') validateCreatePatientProfile({ id: String(p.id), preferredName: p.preferred_name as string,
    ageBracket: p.age_bracket as AgeBracket | null, emergencyName: p.emergency_name as string | null, emergencyPhone: p.emergency_phone as string | null });
  if (r.entity_type === 'adaptive_model_state') {
    if (!Number.isSafeInteger(p.sample_count) || Number(p.sample_count) < 0 ||
        ['bias', 'weight_accuracy', 'weight_pace', 'weight_memory', 'weight_hints', 'weight_stability'].some(key => typeof p[key] !== 'number' || Number(p[key]) < -2 || Number(p[key]) > 2)) {
      throw new Error('Invalid adaptive model.');
    }
  }
  if ((r.entity_type === 'patient_profiles' ? p.id : p.patient_id) !== r.patient_id) throw new Error('Invalid patient ownership.');
  const expectedId = r.entity_type === 'patient_settings' ? r.patient_id
    : r.entity_type === 'adaptive_model_state' ? `${r.patient_id}:${p.game_type}`
      : r.entity_type === 'reminder_events' ? `${p.reminder_id}:${String(p.scheduled_for).slice(0, 10)}` : p.id;
  if (r.entity_id !== expectedId || ('id' in p && !id(p.id)) || ('reminder_id' in p && !id(p.reminder_id))) throw new Error('Invalid entity identity.');
  if ('game_type' in p && !CognitiveActivityTypes.includes(p.game_type as typeof CognitiveActivityTypes[number])) throw new Error('Invalid activity.');
  // Domain constraints remain enforced by SQLite; protect timestamps/numeric/text shape before SQL binding.
  for (const [column, item] of Object.entries(p)) {
    if (column.endsWith('_at') && item !== null && (typeof item !== 'string' || !Number.isFinite(Date.parse(item)))) throw new Error('Invalid timestamp.');
    if (typeof item === 'string' && item.length > 2048) throw new Error('Invalid text size.');
  }
  return r;
}
