import type { SQLiteDatabase } from 'expo-sqlite';
import { LOCATION_COLUMNS } from '../../cloud/location-sync-columns';

export const patientLocationMigration = {
  version: 14, name: 'patient_location',
  async up(db: SQLiteDatabase) {
    await db.execAsync(`
      CREATE TABLE patient_tracking (
        patient_id TEXT PRIMARY KEY NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
        status TEXT NOT NULL CHECK(status IN ('ACTIVE','PAUSED','PERMISSION_REQUIRED','LOCATION_DISABLED','ERROR')),
        consented_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX one_tracked_patient ON patient_tracking(enabled) WHERE enabled=1;
      CREATE TABLE patient_locations (
        id TEXT PRIMARY KEY NOT NULL, patient_id TEXT NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
        latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
        accuracy REAL CHECK(accuracy >= 0), recorded_at TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('background','last_known')),
        UNIQUE(patient_id,recorded_at,latitude,longitude)
      );
      CREATE INDEX latest_patient_location ON patient_locations(patient_id,recorded_at DESC);
    `);
    // Rebuild only the outbox allowlist, within the migration runner's transaction.
    const original = await db.getFirstAsync<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE type='table' AND name='sync_outbox'");
    if (!original) throw new Error('Missing outbox.');
    const triggers = await db.getAllAsync<{ name: string; sql: string }>("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND instr(lower(sql),'sync_outbox')>0");
    const indexes = await db.getAllAsync<{ sql: string }>("SELECT sql FROM sqlite_schema WHERE type='index' AND tbl_name='sync_outbox' AND sql IS NOT NULL");
    const sequence = await db.getFirstAsync<{ seq: number; rowid: number }>("SELECT rowid,seq FROM sqlite_sequence WHERE name='sync_outbox'");
    const sql = original.sql.replace(/CREATE TABLE\s+"?sync_outbox"?/i, 'CREATE TABLE sync_outbox_v14')
      .replace(/entity_type IN \(([^)]+)\)/, "entity_type IN ($1,'patient_locations')");
    if (!sql.includes("'patient_locations'")) throw new Error('Unexpected outbox schema.');
    await db.execAsync(sql);
    await db.execAsync('INSERT INTO sync_outbox_v14 SELECT * FROM sync_outbox;');
    if (await db.getFirstAsync('SELECT * FROM sync_outbox EXCEPT SELECT * FROM sync_outbox_v14')) throw new Error('Outbox copy failed.');
    for (const trigger of triggers) await db.execAsync('DROP TRIGGER "' + trigger.name.replaceAll('"','""') + '"');
    await db.execAsync('DROP TABLE sync_outbox; ALTER TABLE sync_outbox_v14 RENAME TO sync_outbox;');
    if (sequence) await db.runAsync("UPDATE sqlite_sequence SET rowid=?,seq=max(seq,?) WHERE name='sync_outbox'",sequence.rowid,sequence.seq);
    else await db.runAsync("DELETE FROM sqlite_sequence WHERE name='sync_outbox'");
    for (const index of indexes) await db.execAsync(index.sql);
    for (const trigger of triggers) await db.execAsync(trigger.sql);
    const payload = (r: string) => `json_object(${LOCATION_COLUMNS.map(c => `'${c}',${r}.${c}`).join(',')})`;
    await db.execAsync(`
      CREATE TRIGGER sync_validate_patient_locations BEFORE INSERT ON sync_outbox
      WHEN NEW.entity_type='patient_locations' AND (NEW.operation!='upsert' OR
        json_extract(NEW.payload,'$.patient_id') IS NOT NEW.patient_id OR json_extract(NEW.payload,'$.id') IS NOT NEW.entity_id OR
        (SELECT count(*) FROM json_each(NEW.payload)) != ${LOCATION_COLUMNS.length} OR
        EXISTS(SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN (${LOCATION_COLUMNS.map(c=>`'${c}'`).join(',')})))
      BEGIN SELECT RAISE(ABORT,'Invalid location outbox payload'); END;
      CREATE TRIGGER sync_patient_locations_insert AFTER INSERT ON patient_locations
      WHEN (SELECT applying_pull=0 FROM sync_installation WHERE singleton=1)
      BEGIN INSERT INTO sync_outbox(owner_id,patient_id,entity_type,entity_id,operation,payload)
        SELECT owner_id,patient_id,'patient_locations',NEW.id,'upsert',${payload('NEW')}
        FROM sync_patient_owners WHERE patient_id=NEW.patient_id; END;
      CREATE TRIGGER sync_initial_patient_locations AFTER INSERT ON sync_patient_owners
      WHEN (SELECT applying_pull=0 FROM sync_installation WHERE singleton=1)
      BEGIN INSERT INTO sync_outbox(owner_id,patient_id,entity_type,entity_id,operation,payload)
        SELECT NEW.owner_id,NEW.patient_id,'patient_locations',r.id,'upsert',${payload('r')}
        FROM patient_locations r WHERE r.patient_id=NEW.patient_id; END;
    `);
    if ((await db.getAllAsync('PRAGMA foreign_key_check')).length) throw new Error('Location foreign key validation failed.');
  },
} as const;
