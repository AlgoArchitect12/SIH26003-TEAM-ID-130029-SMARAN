import type { SQLiteDatabase } from 'expo-sqlite';
export const liveLocationMigration = {
  version: 15, name: 'live_location',
  async up(db: SQLiteDatabase) {
    await db.execAsync(`
      CREATE TABLE location_device (
        patient_id TEXT PRIMARY KEY REFERENCES patient_profiles(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL, epoch TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),
        pending_control TEXT CHECK(pending_control IN('pause','revoke')), updated_at TEXT NOT NULL
      );
      CREATE TABLE location_queue (
        id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES location_device(patient_id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL, epoch TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), recorded_at TEXT NOT NULL
      );
      CREATE INDEX location_queue_time ON location_queue(patient_id,recorded_at);
    `);
  },
} as const;
