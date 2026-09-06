import type { SQLiteDatabase } from 'expo-sqlite';

export const myMemoriesMigration = {
  version: 5,
  name: 'my_memories',
  async up(database: SQLiteDatabase) {
    await database.execAsync(`
      CREATE TABLE personal_memories (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
        relationship TEXT NOT NULL DEFAULT '' CHECK (length(relationship) <= 100),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
        photo_path TEXT UNIQUE CHECK (photo_path IS NULL OR (
          length(photo_path) <= 200 AND
          substr(photo_path,1,length('memories/' || patient_id || '/')) = 'memories/' || patient_id || '/' AND
          instr(photo_path,'..') = 0 AND instr(photo_path,char(92)) = 0
        )),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE RESTRICT
      );
      CREATE INDEX idx_personal_memories_patient_updated ON personal_memories(patient_id, updated_at DESC, id);
    `);
  },
} as const;
