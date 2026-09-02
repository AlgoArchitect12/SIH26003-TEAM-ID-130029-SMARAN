import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'smaran_offline.db';

export async function initializeDatabase(): Promise<SQLiteDatabase> {
  throw new Error('Local SQLite persistence requires a supported native platform.');
}

export function getDatabase() {
  return initializeDatabase();
}
