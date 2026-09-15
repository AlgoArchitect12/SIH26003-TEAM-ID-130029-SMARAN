import type { SQLiteDatabase } from 'expo-sqlite';
import { CARE_SYNC_COLUMNS, SYNC_COLUMNS } from '../../cloud/care-sync-columns';

export const CARE_CIRCLE_REPORTS_SQL = `
  CREATE TABLE care_circle_members (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 80),
    relationship TEXT NOT NULL CHECK (length(trim(relationship)) BETWEEN 1 AND 100),
    access_role TEXT NOT NULL CHECK (access_role IN ('family','caregiver','healthcare_worker')),
    email TEXT CHECK (email IS NULL OR length(email) BETWEEN 3 AND 254),
    phone TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 5 AND 32),
    status TEXT NOT NULL DEFAULT 'local' CHECK (status IN ('local','revoked')),
    scopes TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(scopes) AND json_type(scopes) = 'array'),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(patient_id, id), CHECK (status != 'revoked' OR scopes = '[]')
  );
  CREATE INDEX idx_care_circle_patient ON care_circle_members(patient_id, status, display_name);
  CREATE TABLE activity_reports (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    period_start TEXT NOT NULL, period_end TEXT NOT NULL CHECK (period_end > period_start),
    generated_at TEXT NOT NULL, report_version INTEGER NOT NULL CHECK (report_version = 1),
    snapshot TEXT NOT NULL CHECK (json_valid(snapshot) AND json_type(snapshot) = 'object' AND length(CAST(snapshot AS BLOB)) <= 12000),
    delivery_state TEXT NOT NULL DEFAULT 'generated' CHECK (delivery_state IN ('generated','share_requested')),
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_reports_patient_date ON activity_reports(patient_id, generated_at DESC, id);
  CREATE TABLE report_preferences (
    patient_id TEXT PRIMARY KEY NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    recipient_id TEXT,
    frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly','monthly')),
    requested INTEGER NOT NULL DEFAULT 0 CHECK (requested IN (0,1)),
    consented_at TEXT, last_requested_at TEXT,
    delivery_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (delivery_status = 'not_configured'),
    updated_at TEXT NOT NULL,
    CHECK (requested = 0 OR (recipient_id IS NOT NULL AND consented_at IS NOT NULL AND last_requested_at IS NOT NULL)),
    FOREIGN KEY (patient_id, recipient_id) REFERENCES care_circle_members(patient_id, id)
  );
  CREATE TRIGGER care_revoke_preferences AFTER UPDATE OF status, scopes, email ON care_circle_members
  WHEN NEW.status = 'revoked' OR NEW.scopes IS NOT OLD.scopes OR NEW.email IS NOT OLD.email
  BEGIN
    UPDATE report_preferences SET requested = 0, consented_at = NULL, updated_at = NEW.updated_at
      WHERE patient_id = NEW.patient_id AND recipient_id = NEW.id;
  END;
`;

export const careCircleReportsMigration = {
  version: 10, name: 'care_circle_reports',
  // Only run through runMigrations, which owns the exclusive rollback transaction.
  async up(database: SQLiteDatabase) {
    await database.execAsync(CARE_CIRCLE_REPORTS_SQL);
    for (const operation of ['INSERT', 'UPDATE']) {
      await database.execAsync(`CREATE TRIGGER care_scopes_${operation.toLowerCase()} BEFORE ${operation} ON care_circle_members
        WHEN EXISTS (SELECT 1 FROM json_each(NEW.scopes) WHERE type != 'text' OR value NOT IN ('daily_activity','reminders','cognitive_activity','reports','memories'))
          OR (SELECT count(*) FROM json_each(NEW.scopes)) != (SELECT count(DISTINCT value) FROM json_each(NEW.scopes))
        BEGIN SELECT RAISE(ABORT, 'Invalid access scopes'); END;`);
    }
    // SQLite cannot ALTER a CHECK allowlist. Copy every outbox column, verify the copy,
    // and replace only this child table. Suspend only triggers that reference it.
    const original = await database.getFirstAsync<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'sync_outbox'");
    if (!original) throw new Error('Missing sync outbox.');
    const triggers = await database.getAllAsync<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' AND instr(lower(sql), 'sync_outbox') > 0");
    const indexes = await database.getAllAsync<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE type = 'index' AND tbl_name = 'sync_outbox' AND sql IS NOT NULL");
    const sequence = await database.getFirstAsync<{ seq: number; rowid: number }>("SELECT rowid, seq FROM sqlite_sequence WHERE name = 'sync_outbox'");
    const sql = original.sql.replace('CREATE TABLE sync_outbox', 'CREATE TABLE sync_outbox_v10')
      .replace(/entity_type IN \([^)]*\)/, `entity_type IN (${Object.keys(SYNC_COLUMNS).map(k => `'${k}'`).join(',')})`);
    if (sql === original.sql || !sql.includes("'care_circle_members'")) throw new Error('Unexpected outbox schema.');
    await database.execAsync(sql);
    await database.execAsync('INSERT INTO sync_outbox_v10 SELECT * FROM sync_outbox;');
    if (await database.getFirstAsync('SELECT * FROM sync_outbox EXCEPT SELECT * FROM sync_outbox_v10')) throw new Error('Outbox copy failed.');
    for (const trigger of triggers) await database.execAsync('DROP TRIGGER "' + trigger.name.replaceAll('"', '""') + '"');
    await database.execAsync('DROP TABLE sync_outbox; ALTER TABLE sync_outbox_v10 RENAME TO sync_outbox;');
    if (sequence) await database.runAsync("UPDATE sqlite_sequence SET rowid = ?, seq = max(seq, ?) WHERE name = 'sync_outbox'", sequence.rowid, sequence.seq);
    else await database.runAsync("DELETE FROM sqlite_sequence WHERE name = 'sync_outbox'");
    for (const index of indexes) await database.execAsync(index.sql);
    for (const trigger of triggers) await database.execAsync(trigger.sql);
    for (const [entity, columns] of Object.entries(CARE_SYNC_COLUMNS)) {
      const identity = entity === 'report_preferences' ? 'patient_id' : 'id';
      const payload = (row: string) => `json_object(${columns.map(c => `'${c}', ${row}.${c}`).join(',')})`;
      await database.execAsync(`CREATE TRIGGER sync_validate_${entity} BEFORE INSERT ON sync_outbox
        WHEN NEW.entity_type = '${entity}' AND (NEW.operation != 'upsert' OR
          json_extract(NEW.payload,'$.patient_id') IS NOT NEW.patient_id OR json_extract(NEW.payload,'$.${identity}') IS NOT NEW.entity_id OR
          (SELECT count(*) FROM json_each(NEW.payload)) != ${columns.length} OR
          EXISTS (SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN (${columns.map(c => `'${c}'`).join(',')})))
        BEGIN SELECT RAISE(ABORT, 'Invalid care outbox payload'); END;`);
      for (const operation of ['INSERT', 'UPDATE']) {
        await database.execAsync(`CREATE TRIGGER sync_${entity}_${operation.toLowerCase()} AFTER ${operation} ON ${entity}
          WHEN (SELECT applying_pull = 0 FROM sync_installation WHERE singleton = 1)
          ${operation === 'UPDATE' ? `AND (${columns.map(c => `OLD.${c} IS NOT NEW.${c}`).join(' OR ')})` : ''}
          BEGIN INSERT INTO sync_outbox(owner_id,patient_id,entity_type,entity_id,operation,payload)
            SELECT owner_id, patient_id, '${entity}', NEW.${identity}, 'upsert', ${payload('NEW')}
            FROM sync_patient_owners WHERE patient_id = NEW.patient_id; END;`);
      }
      await database.execAsync(`CREATE TRIGGER sync_initial_${entity} AFTER INSERT ON sync_patient_owners
        WHEN (SELECT applying_pull = 0 FROM sync_installation WHERE singleton = 1)
        BEGIN INSERT INTO sync_outbox(owner_id,patient_id,entity_type,entity_id,operation,payload)
          SELECT NEW.owner_id, NEW.patient_id, '${entity}', r.${identity}, 'upsert', ${payload('r')}
          FROM ${entity} r WHERE r.patient_id = NEW.patient_id; END;`);
    }
    if ((await database.getAllAsync('PRAGMA foreign_key_check')).length) throw new Error('Care Circle migration failed foreign key validation.');
  },
} as const;
