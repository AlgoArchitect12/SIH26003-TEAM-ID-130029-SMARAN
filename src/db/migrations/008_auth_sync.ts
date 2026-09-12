import type { SQLiteDatabase } from 'expo-sqlite';

// Versioned wire allowlist. Never include SecureStore, user_id, photo_path or notification state.
export const SYNC_COLUMNS_V1 = {
  patient_profiles: ['id', 'preferred_name', 'age_bracket', 'emergency_name', 'emergency_phone', 'created_at', 'updated_at'],
  patient_settings: ['patient_id', 'language', 'region', 'text_size', 'high_contrast', 'voice_guidance', 'reduced_motion', 'updated_at'],
  reminders: ['id', 'patient_id', 'type', 'title', 'note', 'time_of_day', 'scheduled_date', 'repeat_rule', 'is_enabled', 'deleted_at', 'created_at', 'updated_at'],
  reminder_events: ['reminder_id', 'patient_id', 'scheduled_for', 'status', 'completed_at', 'created_at'],
  cognitive_sessions: ['id', 'patient_id', 'game_type', 'difficulty', 'started_at', 'completed_at', 'total_pairs', 'attempts', 'matches', 'hints_used', 'repeated_mistakes', 'avg_response_ms', 'accuracy', 'feedback_label', 'recommended_difficulty', 'created_at', 'challenges_completed', 'steps_completed', 'correct_selections', 'repeated_errors'],
  adaptive_model_state: ['patient_id', 'game_type', 'bias', 'weight_accuracy', 'weight_pace', 'weight_memory', 'weight_hints', 'weight_stability', 'sample_count', 'updated_at'],
  personal_memories: ['id', 'patient_id', 'name', 'relationship', 'description', 'created_at', 'updated_at'],
} as const;
export type SyncEntity = keyof typeof SYNC_COLUMNS_V1;

export function syncIdentitySQL(entity: SyncEntity, row: string) {
  if (entity === 'patient_settings') return `${row}.patient_id`;
  if (entity === 'adaptive_model_state') return `${row}.patient_id || ':' || ${row}.game_type`;
  if (entity === 'reminder_events') return `${row}.reminder_id || ':' || substr(${row}.scheduled_for,1,10)`;
  return `${row}.id`;
}
export function syncPayloadSQL(entity: SyncEntity, row: string) {
  return `json_object(${SYNC_COLUMNS_V1[entity].map(column => `'${column}', ${row}.${column}`).join(', ')})`;
}

export const AUTH_SYNC_SQL = `
  CREATE TABLE sync_accounts (
    owner_id TEXT PRIMARY KEY NOT NULL CHECK (length(owner_id) = 36),
    pull_cursor INTEGER NOT NULL DEFAULT 0 CHECK (pull_cursor >= 0),
    last_success_at TEXT,
    linked_at TEXT NOT NULL
  );
  CREATE TABLE sync_installation (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    installation_id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
    default_owner_id TEXT REFERENCES sync_accounts(owner_id),
    applying_pull INTEGER NOT NULL DEFAULT 0 CHECK (applying_pull IN (0,1))
  );
  INSERT INTO sync_installation(singleton) VALUES(1);
  CREATE TABLE sync_patient_owners (
    patient_id TEXT PRIMARY KEY NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    owner_id TEXT NOT NULL REFERENCES sync_accounts(owner_id),
    linked_at TEXT NOT NULL,
    UNIQUE(owner_id, patient_id)
  );
  CREATE TRIGGER sync_ownership_immutable BEFORE UPDATE ON sync_patient_owners
    BEGIN SELECT RAISE(ABORT, 'Cloud patient ownership cannot change'); END;
  CREATE TABLE sync_outbox (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (length(mutation_id) = 32 AND mutation_id NOT GLOB '*[^0-9a-f]*'),
    owner_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN (${Object.keys(SYNC_COLUMNS_V1).map(key => `'${key}'`).join(',')})),
    entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 256),
    operation TEXT NOT NULL CHECK (operation IN ('upsert','delete')),
    payload TEXT NOT NULL CHECK (json_valid(payload) AND json_type(payload) = 'object' AND length(CAST(payload AS BLOB)) <= 16384),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
    next_attempt_at INTEGER NOT NULL DEFAULT 0 CHECK (next_attempt_at >= 0),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','failed')),
    last_failure TEXT CHECK (last_failure IS NULL OR last_failure IN ('network','auth','server','invalid','conflict')),
    FOREIGN KEY (owner_id, patient_id) REFERENCES sync_patient_owners(owner_id, patient_id),
    CHECK (operation != 'delete' OR (entity_type = 'personal_memories' AND payload = '{}'))
  );
  CREATE INDEX idx_sync_outbox_owner_sequence ON sync_outbox(owner_id, sequence);
  CREATE TABLE sync_versions (
    owner_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    PRIMARY KEY (owner_id, entity_type, entity_id),
    FOREIGN KEY (owner_id, patient_id) REFERENCES sync_patient_owners(owner_id, patient_id)
  );
  -- Explicit ownership checks also protect Expo transaction connections with FK enforcement off.
  CREATE TRIGGER sync_outbox_owner_check BEFORE INSERT ON sync_outbox
  WHEN NOT EXISTS (SELECT 1 FROM sync_patient_owners WHERE owner_id = NEW.owner_id AND patient_id = NEW.patient_id)
    BEGIN SELECT RAISE(ABORT, 'Invalid outbox ownership'); END;
  CREATE TRIGGER sync_outbox_event_immutable BEFORE UPDATE OF mutation_id,owner_id,patient_id,entity_type,entity_id,operation,payload,created_at ON sync_outbox
    BEGIN SELECT RAISE(ABORT, 'Outbox event identity is immutable'); END;
  CREATE TRIGGER sync_profile_link AFTER INSERT ON patient_profiles
  WHEN (SELECT applying_pull = 0 AND default_owner_id IS NOT NULL FROM sync_installation WHERE singleton = 1)
    BEGIN
      INSERT INTO sync_patient_owners(patient_id, owner_id, linked_at)
        SELECT NEW.id, default_owner_id, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM sync_installation WHERE singleton = 1;
    END;
`;

export const authSyncMigration = {
  version: 8,
  name: 'auth_sync',
  async up(database: SQLiteDatabase) {
    await database.execAsync(AUTH_SYNC_SQL);
    for (const entity of Object.keys(SYNC_COLUMNS_V1) as SyncEntity[]) {
      const patient = entity === 'patient_profiles' ? 'id' : 'patient_id';
      const columns = SYNC_COLUMNS_V1[entity];
      const identity = entity === 'patient_settings' ? "json_extract(NEW.payload,'$.patient_id')"
        : entity === 'adaptive_model_state' ? "json_extract(NEW.payload,'$.patient_id') || ':' || json_extract(NEW.payload,'$.game_type')"
          : entity === 'reminder_events' ? "json_extract(NEW.payload,'$.reminder_id') || ':' || substr(json_extract(NEW.payload,'$.scheduled_for'),1,10)"
            : "json_extract(NEW.payload,'$.id')";
      await database.execAsync(`CREATE TRIGGER sync_validate_${entity} BEFORE INSERT ON sync_outbox
        WHEN NEW.entity_type = '${entity}' AND NEW.operation = 'upsert' AND (
          json_extract(NEW.payload,'$.${patient}') IS NOT NEW.patient_id OR ${identity} IS NOT NEW.entity_id OR
          (SELECT count(*) FROM json_each(NEW.payload)) != ${columns.length} OR
          EXISTS (SELECT 1 FROM json_each(NEW.payload) WHERE key NOT IN (${columns.map(column => `'${column}'`).join(',')})))
        BEGIN SELECT RAISE(ABORT, 'Invalid outbox payload'); END;`);
      // Profile INSERT is captured by the ownership trigger below; trigger ordering is unspecified.
      const operations = entity === 'patient_profiles' ? ['UPDATE'] : entity === 'reminder_events' ? ['INSERT']
        : entity === 'personal_memories' ? ['INSERT', 'UPDATE', 'DELETE'] : ['INSERT', 'UPDATE'];
      for (const operation of operations) {
        const row = operation === 'DELETE' ? 'OLD' : 'NEW';
        const changed = operation === 'UPDATE'
          ? `AND (${SYNC_COLUMNS_V1[entity].map(column => `OLD.${column} IS NOT NEW.${column}`).join(' OR ')})` : '';
        await database.execAsync(`
          CREATE TRIGGER sync_${entity}_${operation.toLowerCase()} AFTER ${operation} ON ${entity}
          WHEN (SELECT applying_pull = 0 FROM sync_installation WHERE singleton = 1)
            ${entity === 'cognitive_sessions' ? `AND ${row}.is_demo_seed = 0` : ''} ${changed}
          BEGIN
            INSERT INTO sync_outbox(owner_id, patient_id, entity_type, entity_id, operation, payload)
            SELECT owner_id, patient_id, '${entity}', ${syncIdentitySQL(entity, row)},
              '${operation === 'DELETE' ? 'delete' : 'upsert'}', ${operation === 'DELETE' ? "'{}'" : syncPayloadSQL(entity, row)}
            FROM sync_patient_owners WHERE patient_id = ${row}.${patient};
          END;
        `);
      }
    }
    // Linking a patient snapshots the complete eligible history once, in the linking transaction.
    await database.execAsync(`CREATE TRIGGER sync_initial_snapshot AFTER INSERT ON sync_patient_owners
      WHEN (SELECT applying_pull = 0 FROM sync_installation WHERE singleton = 1)
      BEGIN
        ${(Object.keys(SYNC_COLUMNS_V1) as SyncEntity[]).map(entity => `
          INSERT INTO sync_outbox(owner_id, patient_id, entity_type, entity_id, operation, payload)
          SELECT NEW.owner_id, NEW.patient_id, '${entity}', ${syncIdentitySQL(entity, 'r')}, 'upsert', ${syncPayloadSQL(entity, 'r')}
          FROM ${entity} r WHERE r.${entity === 'patient_profiles' ? 'id' : 'patient_id'} = NEW.patient_id
          ${entity === 'cognitive_sessions' ? 'AND r.is_demo_seed = 0' : ''};`).join('\n')}
      END;`);
    if ((await database.getAllAsync('PRAGMA foreign_key_check')).length) throw new Error('Auth sync migration failed foreign key validation.');
  },
} as const;
