import type { SQLiteDatabase } from 'expo-sqlite';

export const syncConsentMigration = {
  version: 11,
  name: 'sync_consent',
  async up(database: SQLiteDatabase) {
    // Retain every owner, cursor and queued mutation. Upgraded accounts explicitly resume backup.
    await database.execAsync(`
      ALTER TABLE sync_accounts ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1));
      DROP TRIGGER sync_profile_link;
      UPDATE sync_installation SET default_owner_id = NULL WHERE singleton = 1;
    `);
  },
} as const;
