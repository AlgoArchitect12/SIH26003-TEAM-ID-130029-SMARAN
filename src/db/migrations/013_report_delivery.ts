import type { SQLiteDatabase } from 'expo-sqlite';
import { SYNC_COLUMNS, MVP28_SYNC_COLUMNS } from '../../cloud/care-sync-columns';

export const REPORT_DELIVERY_SQL = `
  CREATE TABLE report_recipients (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    care_member_id TEXT REFERENCES care_circle_members(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp')),
    normalized_destination TEXT NOT NULL CHECK (length(normalized_destination) BETWEEN 5 AND 32),
    consent_status TEXT NOT NULL DEFAULT 'enabled' CHECK (consent_status IN ('enabled','revoked')),
    frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly','monthly','manual')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revoked_at TEXT,
    UNIQUE(patient_id, care_member_id),
    CHECK (consent_status = 'enabled' OR revoked_at IS NOT NULL)
  );

  CREATE INDEX idx_report_recipients_patient ON report_recipients(patient_id, consent_status);

  CREATE TABLE report_deliveries (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES report_recipients(id) ON DELETE CASCADE,
    report_period TEXT NOT NULL CHECK (report_period IN ('7-day','30-day','manual')),
    report_start TEXT NOT NULL,
    report_end TEXT NOT NULL CHECK (report_end > report_start),
    report_snapshot_id TEXT NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('not_configured','queued','sending','sent','delivered','failed','cancelled','share_requested')),
    provider TEXT CHECK (provider IN ('whatsapp_business','manual_share')),
    provider_message_id TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    queued_at TEXT NOT NULL,
    sent_at TEXT,
    delivered_at TEXT,
    failed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX idx_report_deliveries_queue ON report_deliveries(status) WHERE status IN ('queued','sending');
  CREATE INDEX idx_report_deliveries_recipient ON report_deliveries(recipient_id, updated_at DESC);
`;

export const reportDeliveryMigration = {
  version: 13, name: 'report_delivery',
  async up(database: SQLiteDatabase) {
    await database.execAsync(REPORT_DELIVERY_SQL);

    // SQLite cannot ALTER a CHECK allowlist. Copy every outbox column, verify the copy,
    // and replace only this child table. Suspend only triggers that reference it.
    const original = await database.getFirstAsync<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'sync_outbox'");
    if (!original) throw new Error('Missing sync outbox.');
    const triggers = await database.getAllAsync<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' AND instr(lower(sql), 'sync_outbox') > 0");
    const indexes = await database.getAllAsync<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE type = 'index' AND tbl_name = 'sync_outbox' AND sql IS NOT NULL");
    const sequence = await database.getFirstAsync<{ seq: number; rowid: number }>("SELECT rowid, seq FROM sqlite_sequence WHERE name = 'sync_outbox'");

    // Replace the entity_type CHECK constraint to include the new columns from SYNC_COLUMNS
    const oldConstraint = "entity_type IN ('patient_profiles','patient_settings','adaptive_model_state','cognitive_sessions','personal_memories','reminders','reminder_events','care_circle_members','activity_reports','report_preferences')";
    const newConstraint = "entity_type IN (" + Object.keys(SYNC_COLUMNS).map(k => "'" + k + "'").join(',') + ")";
    const sql = original.sql.split('CREATE TABLE sync_outbox').join('CREATE TABLE sync_outbox_v13').split('CREATE TABLE "sync_outbox"').join('CREATE TABLE sync_outbox_v13').split(oldConstraint).join(newConstraint);

    if (sql === original.sql || !sql.includes("'report_recipients'")) throw new Error('Unexpected outbox schema.');
    await database.execAsync(sql);
    await database.execAsync('INSERT INTO sync_outbox_v13 SELECT * FROM sync_outbox;');
    if (await database.getFirstAsync('SELECT * FROM sync_outbox EXCEPT SELECT * FROM sync_outbox_v13')) throw new Error('Outbox copy failed.');
    for (const trigger of triggers) await database.execAsync('DROP TRIGGER "' + trigger.name.replaceAll('"', '""') + '"');
    await database.execAsync('DROP TABLE sync_outbox; ALTER TABLE sync_outbox_v13 RENAME TO sync_outbox;');
    if (sequence) await database.runAsync("UPDATE sqlite_sequence SET rowid = ?, seq = max(seq, ?) WHERE name = 'sync_outbox'", sequence.rowid, sequence.seq);
    else await database.runAsync("DELETE FROM sqlite_sequence WHERE name = 'sync_outbox'");
    for (const index of indexes) await database.execAsync(index.sql);
    for (const trigger of triggers) await database.execAsync(trigger.sql);

    // Create sync triggers for the new tables
    for (const entity of ['report_recipients', 'report_deliveries'] as const) {
      const columns = MVP28_SYNC_COLUMNS[entity];
      const identity = 'id';
      const payload = (row: string) => `json_object(${columns.map(c => `'${c}', ${row}.${c}`).join(',')})`;

      await database.execAsync(`CREATE TRIGGER sync_validate_${entity} BEFORE INSERT ON sync_outbox
        WHEN NEW.entity_type = '${entity}' AND (NEW.operation != 'upsert' OR
          json_extract(NEW.payload,'$.patient_id') IS NOT NEW.patient_id OR json_extract(NEW.payload,'$.${identity}') IS NOT NEW.entity_id OR
          (SELECT count(*) FROM json_each(NEW.payload)) != ${columns.length} OR
          EXISTS (SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN (${columns.map(c => `'${c}'`).join(',')})))` +
        ` BEGIN SELECT RAISE(ABORT, 'Invalid ${entity} outbox payload'); END;`);

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

    if ((await database.getAllAsync('PRAGMA foreign_key_check')).length) throw new Error('Report delivery migration failed foreign key validation.');
  },
} as const;
