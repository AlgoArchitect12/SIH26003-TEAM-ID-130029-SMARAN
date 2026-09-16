import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../client';
import { SYNC_COLUMNS as SYNC_COLUMNS_V1 } from '../../cloud/care-sync-columns';
import { assertOwner, BATCH_SIZE, validateCloudRecord, type CloudRecord, type OutboxEvent, type PullBatch, type PushReceipt } from '../../cloud/sync-contract';

function check(current: () => boolean) { if (!current()) throw new Error('Account request expired.'); }
async function link(owner: string, current: () => boolean) {
  assertOwner(owner); check(current);
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    const now = new Date().toISOString();
    await tx.runAsync('INSERT INTO sync_accounts(owner_id, linked_at) VALUES(?,?) ON CONFLICT DO NOTHING', owner, now);
    await tx.runAsync('UPDATE sync_accounts SET enabled = 1 WHERE owner_id = ?', owner);
    await tx.runAsync(`INSERT INTO sync_patient_owners(patient_id, owner_id, linked_at)
      SELECT id, ?, ? FROM patient_profiles WHERE id NOT IN (SELECT patient_id FROM sync_patient_owners)`, owner, now);
    await tx.runAsync('UPDATE sync_installation SET default_owner_id = ? WHERE singleton = 1', owner);
    check(current);
  });
}
async function status(owner: string) {
  assertOwner(owner);
  const db = await getDatabase();
  const account = await db.getFirstAsync<{ pull_cursor: number; last_success_at: string | null; enabled: number }>('SELECT pull_cursor, last_success_at, enabled FROM sync_accounts WHERE owner_id = ?', owner);
  const counts = await db.getFirstAsync<{ pending: number; failed: number }>(
    "SELECT count(*) AS pending, coalesce(sum(state = 'failed'),0) AS failed FROM sync_outbox WHERE owner_id = ?", owner);
  const unlinked = await db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM patient_profiles WHERE id NOT IN (SELECT patient_id FROM sync_patient_owners)');
  return { linked: account?.enabled === 1, paused: account?.enabled === 0, unlinked: unlinked?.count ?? 0, cursor: account?.pull_cursor ?? 0, lastSuccess: account?.last_success_at ?? null, pending: counts?.pending ?? 0, failed: counts?.failed ?? 0 };
}
async function pause(owner: string, current: () => boolean) {
  assertOwner(owner);
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    await tx.runAsync('UPDATE sync_accounts SET enabled = 0 WHERE owner_id = ?', owner);
    await tx.runAsync('UPDATE sync_installation SET default_owner_id = NULL WHERE default_owner_id = ?', owner);
    check(current);
  });
}
async function activate(owner: string, current: () => boolean) {
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    await tx.runAsync(`UPDATE sync_installation SET default_owner_id = ? WHERE singleton = 1
      AND EXISTS (SELECT 1 FROM sync_accounts WHERE owner_id = ?)`, owner, owner);
    check(current);
  });
}
async function pending(owner: string) {
  assertOwner(owner);
  // Snapshot triggers can enqueue children first. Send parents first, retaining
  // sequence order (including failed/backoff events) within each entity.
  return (await getDatabase()).getAllAsync<OutboxEvent>(`SELECT * FROM sync_outbox WHERE owner_id = ?
    ORDER BY CASE entity_type WHEN 'patient_profiles' THEN 0 WHEN 'reminders' THEN 1 WHEN 'care_circle_members' THEN 1 ELSE 2 END,
      sequence LIMIT ?`, owner, BATCH_SIZE);
}
async function acknowledge(owner: string, sent: OutboxEvent[], receipts: PushReceipt[], current: () => boolean, now = Date.now()) {
  if (!Array.isArray(receipts) || receipts.length !== sent.length || receipts.some((r, i) => !r || typeof r !== 'object' || r.mutation_id !== sent[i].mutation_id ||
      !['applied', 'duplicate', 'rejected'].includes(r.status) || (r.status === 'rejected' && !['invalid', 'conflict', 'server'].includes(r.error ?? '')))) {
    throw new Error('Invalid sync acknowledgement.');
  }
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    for (const receipt of receipts) {
      if (receipt.status === 'rejected') await failIn(tx, owner, receipt.mutation_id, receipt.error!, now);
      else await tx.runAsync('DELETE FROM sync_outbox WHERE owner_id = ? AND mutation_id = ?', owner, receipt.mutation_id);
    }
    check(current);
  });
}
async function failIn(tx: SQLiteDatabase, owner: string, id: string, reason: string, now: number) {
  await tx.runAsync(`UPDATE sync_outbox SET attempts = min(attempts + 1,8), last_failure = ?,
    next_attempt_at = ? + min(300000, 2000 * (1 << attempts)),
    state = CASE WHEN (attempts >= 7 AND ? = 'server') OR ? IN ('invalid','conflict') THEN 'failed' ELSE 'pending' END
    WHERE owner_id = ? AND mutation_id = ?`, reason, now, reason, reason, owner, id);
}
async function fail(owner: string, events: OutboxEvent[], reason: 'network' | 'auth' | 'server', current: () => boolean, now = Date.now()) {
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    for (const event of events) await failIn(tx, owner, event.mutation_id, reason, now);
    check(current);
  });
}
async function retry(owner: string, current: () => boolean) {
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    await tx.runAsync("UPDATE sync_outbox SET attempts = 0, next_attempt_at = 0, state = 'pending', last_failure = NULL WHERE owner_id = ?", owner);
    check(current);
  });
}
async function applyRecord(tx: SQLiteDatabase, r: CloudRecord) {
  const owner = await tx.getFirstAsync<{ owner_id: string }>('SELECT owner_id FROM sync_patient_owners WHERE patient_id = ?', r.patient_id);
  const existingPatient = await tx.getFirstAsync('SELECT id FROM patient_profiles WHERE id = ?', r.patient_id);
  if (owner ? owner.owner_id !== r.owner_id : existingPatient || r.entity_type !== 'patient_profiles') throw new Error('Local patient ownership conflict.');
  const previous = await tx.getFirstAsync<{ version: number }>(
    'SELECT version FROM sync_versions WHERE owner_id = ? AND entity_type = ? AND entity_id = ?', r.owner_id, r.entity_type, r.entity_id);
  if (previous && previous.version >= r.version) return;
  const p = r.payload;
  if (r.deleted) {
    await tx.runAsync('DELETE FROM personal_memories WHERE patient_id = ? AND id = ?', r.patient_id, r.entity_id);
  } else {
    const columns: string[] = [...SYNC_COLUMNS_V1[r.entity_type]];
    const values = columns.map(column => p[column]);
    let conflict = 'id';
    if (r.entity_type === 'patient_settings') { columns.push('id'); values.push(`cloud-settings-${r.patient_id}`); conflict = 'patient_id'; }
    if (r.entity_type === 'report_preferences') conflict = 'patient_id';
    if (r.entity_type === 'adaptive_model_state') conflict = 'patient_id, game_type';
    if (r.entity_type === 'reminder_events') conflict = '';
    // Cross-patient collisions are rejected before an UPSERT can touch an existing identity.
    if (['reminders', 'personal_memories', 'cognitive_sessions', 'care_circle_members', 'activity_reports'].includes(r.entity_type)) {
      const local = await tx.getFirstAsync<{ patient_id: string }>(`SELECT patient_id FROM ${r.entity_type} WHERE id = ?`, r.entity_id);
      if (local && local.patient_id !== r.patient_id) throw new Error('Local record ownership conflict.');
    }
    if (r.entity_type === 'reminder_events' && !await tx.getFirstAsync('SELECT id FROM reminders WHERE patient_id = ? AND id = ?', r.patient_id, p.reminder_id)) {
      throw new Error('Missing reminder parent.');
    }
    if (r.entity_type === 'report_preferences' && p.recipient_id !== null) {
      const recipient = await tx.getFirstAsync<{ status: string; scopes: string; email: string | null; updated_at: string }>('SELECT status,scopes,email,updated_at FROM care_circle_members WHERE patient_id=? AND id=?',r.patient_id,p.recipient_id);
      if (!recipient) throw new Error('Missing report recipient.');
      // A stale preference cannot reinstate consent after recipient revocation or access removal.
      if (p.requested === 1 && (recipient.status !== 'local' || !recipient.email || !JSON.parse(recipient.scopes).includes('reports') ||
          Date.parse(String(p.consented_at)) < Date.parse(recipient.updated_at))) {
        values[columns.indexOf('requested')] = 0; values[columns.indexOf('consented_at')] = null;
      }
    }
    const immutable = ['cognitive_sessions', 'reminder_events'].includes(r.entity_type);
    const changes = columns.filter(column => !['id', 'patient_id', 'created_at'].includes(column)).map(column => `${column} = excluded.${column}`);
    if (r.entity_type === 'reminders') changes.push('revision = reminders.revision + 1');
    await tx.runAsync(`INSERT INTO ${r.entity_type} (${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})
      ON CONFLICT ${conflict ? `(${conflict})` : ''} DO ${immutable ? 'NOTHING' : `UPDATE SET ${changes.join(',')}`}`, ...values);
    if (!owner) await tx.runAsync('INSERT INTO sync_patient_owners(patient_id, owner_id, linked_at) VALUES(?,?,?)', r.patient_id, r.owner_id, new Date().toISOString());
  }
  await tx.runAsync(`INSERT INTO sync_versions(owner_id, patient_id, entity_type, entity_id, version) VALUES(?,?,?,?,?)
    ON CONFLICT(owner_id, entity_type, entity_id) DO UPDATE SET version = excluded.version`, r.owner_id, r.patient_id, r.entity_type, r.entity_id, r.version);
}
async function apply(owner: string, raw: PullBatch, cursor: number, current: () => boolean) {
  if (!raw || !Array.isArray(raw.records) || !Array.isArray(raw.parents) || raw.records.length > BATCH_SIZE || raw.parents.length > BATCH_SIZE * 3 ||
      !Number.isSafeInteger(raw.cursor) || raw.cursor < cursor || typeof raw.has_more !== 'boolean') throw new Error('Invalid sync batch.');
  const records = raw.records.map(r => validateCloudRecord(r, owner));
  const parents = raw.parents.map(r => validateCloudRecord(r, owner));
  let last = cursor;
  for (const r of records) { if (r.version <= last) throw new Error('Invalid sync order.'); last = r.version; }
  if (last !== raw.cursor || (raw.has_more && !records.length) || parents.some(r => !['patient_profiles', 'patient_settings', 'reminders', 'care_circle_members'].includes(r.entity_type))) throw new Error('Invalid sync cursor/parents.');
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    const account = await tx.getFirstAsync<{ pull_cursor: number }>('SELECT pull_cursor FROM sync_accounts WHERE owner_id = ?', owner);
    if (account?.pull_cursor !== cursor || await tx.getFirstAsync('SELECT sequence FROM sync_outbox WHERE owner_id = ? LIMIT 1', owner)) throw new Error('Local changes are waiting.');
    await tx.runAsync('UPDATE sync_installation SET applying_pull = 1 WHERE singleton = 1');
    const rank = (r: CloudRecord) => ['patient_profiles', 'patient_settings', 'reminders', 'care_circle_members'].indexOf(r.entity_type);
    for (const r of parents.sort((a, b) => rank(a) - rank(b) || a.version - b.version)) await applyRecord(tx, r);
    for (const r of records) await applyRecord(tx, r);
    await tx.runAsync('UPDATE sync_accounts SET pull_cursor = ? WHERE owner_id = ?', raw.cursor, owner);
    await tx.runAsync('UPDATE sync_installation SET applying_pull = 0 WHERE singleton = 1');
    check(current);
  });
}
async function success(owner: string, current: () => boolean) {
  await (await getDatabase()).withExclusiveTransactionAsync(async tx => {
    check(current);
    if (!await tx.getFirstAsync('SELECT sequence FROM sync_outbox WHERE owner_id = ? LIMIT 1', owner)) {
      await tx.runAsync('UPDATE sync_accounts SET last_success_at = ? WHERE owner_id = ?', new Date().toISOString(), owner);
    }
    check(current);
  });
}
export const syncRepository = { link, status, activate, pause, pending, acknowledge, fail, retry, apply, success };
