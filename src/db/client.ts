import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';

export const DATABASE_NAME = 'smaran_offline.db';

let database: SQLiteDatabase | null = null;
let openPromise: Promise<SQLiteDatabase> | null = null;
let initializationPromise: Promise<SQLiteDatabase> | null = null;
let initialized = false;

async function openSharedDatabase() {
  if (database) {
    return database;
  }

  openPromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    database = await openPromise;
    return database;
  } finally {
    openPromise = null;
  }
}

export function initializeDatabase() {
  if (initialized && database) {
    return Promise.resolve(database);
  }

  initializationPromise ??= (async () => {
    const sharedDatabase = await openSharedDatabase();
    await sharedDatabase.execAsync('PRAGMA journal_mode = WAL;');
    await sharedDatabase.execAsync('PRAGMA foreign_keys = ON;');

    const foreignKeys = await sharedDatabase.getFirstAsync<{ foreign_keys: number }>(
      'PRAGMA foreign_keys'
    );
    if (foreignKeys?.foreign_keys !== 1) {
      throw new Error('SQLite foreign key enforcement could not be enabled.');
    }

    await runMigrations(sharedDatabase);
    initialized = true;
    return sharedDatabase;
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
}

export function getDatabase() {
  return initializeDatabase();
}
