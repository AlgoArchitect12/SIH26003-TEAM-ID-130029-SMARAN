import { captureAccount, getCloudClient } from '../cloud/auth';
import { CareScopes } from '../caregiver/care-circle';
import { validateRecordId } from '../utils/validation';
export const PairingScopes = [...CareScopes, 'location'] as const;

export type PairingRole = 'family' | 'caregiver' | 'healthcare_worker';
export type PairingGrant = { patientId: string; accessRole: PairingRole; scopes: string[]; label: string };
export type MembershipLink = { patientId: string; memberId?: string; accessRole: PairingRole;
  scopes: string[]; label: string; revoked?: boolean; displayName?: string | null };
export type GrantedSnapshot = { patientId: string; displayName: string | null; scopes: string[];
  counts: { sessions_total: number; sessions_7d: number; reminders_pending: number; memories: number; reports: number } | null;
  sessions: { game: string; attempts: number; accuracy: number; completed: string }[] | null;
  reminders: { id: string; version: number; title: string; type: string; time: string; repeat: string; date: string | null }[] | null;
  memories: { id: string; version: number; name: string; relationship: string; description: string }[] | null;
  reports: { generated_at: string; period_start: string; period_end: string }[] | null };

export type PairingErrorKey = 'pairingSignIn' | 'pairingOffline' | 'pairingFailed' | 'pairingInvalid'
  | 'pairingExpired' | 'pairingRateLimited' | 'pairingForbidden' | 'pairingInvalidInput';

const codePattern = /^[A-F0-9]{16}$/;
const roles: readonly PairingRole[] = ['family', 'caregiver', 'healthcare_worker'];
const envelopeErrors: Record<string, PairingErrorKey> = { invalid_code: 'pairingInvalid', expired: 'pairingExpired',
  rate_limited: 'pairingRateLimited', forbidden: 'pairingForbidden', invalid_input: 'pairingFailed', conflict: 'pairingFailed' };

function fail(key: PairingErrorKey): never { throw new Error(key); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function grant(value: unknown): PairingGrant {
  if (!isRecord(value) || typeof value.patient_id !== 'string' || !roles.includes(value.access_role as PairingRole) ||
      !Array.isArray(value.scopes) || typeof value.label !== 'string') fail('pairingFailed');
  const scopes = (value.scopes as unknown[]).filter((scope): scope is string => typeof scope === 'string');
  return { patientId: value.patient_id as string, accessRole: value.access_role as PairingRole, scopes, label: value.label as string };
}
async function call<T>(method: string, args: Record<string, unknown>, parse: (data: Record<string, unknown>) => T): Promise<T> {
  const account = captureAccount();
  if (!account.current()) fail('pairingSignIn');
  let result: { error: unknown; status?: number; data: unknown };
  try {
    result = await getCloudClient().rpc(method, args).abortSignal(account.signal) as typeof result;
  } catch { fail('pairingOffline'); }
  if (!account.current()) fail('pairingSignIn');
  if (result!.error) {
    if (result!.status === 0) fail('pairingOffline');
    fail('pairingFailed');
  }
  const data = result!.data;
  if (!isRecord(data)) fail('pairingFailed');
  if (data.ok !== true) {
    fail(typeof data.error === 'string' && data.error in envelopeErrors ? envelopeErrors[data.error] : 'pairingFailed');
  }
  if (!account.current()) fail('pairingSignIn');
  return parse(data as Record<string, unknown>);
}
function checkScopes(scopes: readonly string[]) {
  if (!scopes.length || scopes.length > PairingScopes.length || scopes.some(scope => !PairingScopes.includes(scope as never))) {
    fail('pairingInvalidInput');
  }
}

export const pairingService = {
  access: (patientId: string) => call('patient_access', { p_patient: validateRecordId(patientId) }, result => {
    if (result.role !== 'owner' && !roles.includes(result.role as PairingRole)) fail('pairingFailed');
    return result.role as 'owner' | PairingRole;
  }),
  async generate(patientId: string, scopes: readonly string[], label: string, role: PairingRole = 'family') {
    validateRecordId(patientId);
    checkScopes(scopes);
    if (!roles.includes(role) || label.length > 64) fail('pairingInvalidInput');
    const data = await call('create_pairing_code',
      { p_patient: patientId, p_scopes: [...scopes], p_label: label, p_role: role }, result => result);
    if (typeof data.code !== 'string' || !codePattern.test(data.code) || typeof data.expires_at !== 'string' ||
        !Number.isFinite(Date.parse(data.expires_at))) fail('pairingFailed');
    return { code: data.code as string, expiresAt: data.expires_at as string };
  },
  async claim(code: string): Promise<PairingGrant> {
    const normalized = code.trim().toUpperCase();
    if (!codePattern.test(normalized)) fail('pairingInvalid');
    return call('claim_pairing_code', { p_code: normalized }, grant);
  },
  async list() {
    const data = await call('list_memberships', {}, result => result);
    if (!Array.isArray(data.received) || !Array.isArray(data.granted)) fail('pairingFailed');
    const link = (item: unknown): MembershipLink => {
      if (!isRecord(item) || typeof item.patient_id !== 'string' || !roles.includes(item.access_role as PairingRole) ||
          !Array.isArray(item.scopes) || typeof item.label !== 'string') fail('pairingFailed');
      return { patientId: item.patient_id as string,
        memberId: typeof item.member_id === 'string' ? item.member_id as string : undefined,
        accessRole: item.access_role as PairingRole,
        scopes: (item.scopes as unknown[]).filter((scope): scope is string => typeof scope === 'string'),
        label: item.label as string,
        revoked: typeof item.revoked === 'boolean' ? item.revoked as boolean : undefined,
        displayName: typeof item.display_name === 'string' ? item.display_name as string : null };
    };
    return { received: (data.received as unknown[]).map(link), granted: (data.granted as unknown[]).map(link) };
  },
  async revoke(patientId: string, memberId?: string) {
    validateRecordId(patientId);
    await call('revoke_membership', memberId ? { p_patient: patientId, p_member: memberId } : { p_patient: patientId }, result => result);
  },
  async snapshot(patientId: string): Promise<GrantedSnapshot> {
    validateRecordId(patientId);
    const data = await call('granted_snapshot', { p_patient: patientId }, result => result);
    if (typeof data.patient_id !== 'string' || !Array.isArray(data.scopes)) fail('pairingFailed');
    return { ...data, patientId: data.patient_id, displayName: data.display_name } as unknown as GrantedSnapshot;
  },
  revokeCodes: (patientId: string) => call('revoke_pairing_codes', { p_patient: validateRecordId(patientId) }, result => result),
  update: (patientId: string, kind: 'reminders' | 'personal_memories', id: string, version: number, patch: Record<string, string | number>) =>
    call('update_shared_record', { p_patient: validateRecordId(patientId), p_kind: kind,
      p_id: validateRecordId(id), p_version: version, p_patch: patch }, result => result),
};
