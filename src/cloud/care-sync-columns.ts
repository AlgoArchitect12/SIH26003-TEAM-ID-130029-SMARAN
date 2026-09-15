import { SYNC_COLUMNS_V1 } from '../db/migrations/008_auth_sync';
// Additive wire contract. Historical migration 008 keeps its original allowlist.
export const CARE_SYNC_COLUMNS = {
  care_circle_members: ['id', 'patient_id', 'display_name', 'relationship', 'access_role', 'email', 'phone', 'status', 'scopes', 'created_at', 'updated_at'],
  activity_reports: ['id', 'patient_id', 'period_start', 'period_end', 'generated_at', 'report_version', 'snapshot', 'delivery_state', 'updated_at'],
  report_preferences: ['patient_id', 'recipient_id', 'frequency', 'requested', 'consented_at', 'last_requested_at', 'delivery_status', 'updated_at'],
} as const;
export const SYNC_COLUMNS = { ...SYNC_COLUMNS_V1, ...CARE_SYNC_COLUMNS } as const;
export type SyncEntity = keyof typeof SYNC_COLUMNS;
