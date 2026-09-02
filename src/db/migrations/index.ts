import type { SQLiteDatabase } from 'expo-sqlite';

import { coreBootstrapMigration } from './001_core_bootstrap';

const migrations = [coreBootstrapMigration] as const;

type AppliedMigrationRow = { version: number };

export async function runMigrations(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index].version <= migrations[index - 1].version) {
      throw new Error('Database migrations must use unique ascending versions.');
    }
  }

  const applied = await database.getAllAsync<AppliedMigrationRow>(
    'SELECT version FROM schema_migrations'
  );
  const appliedVersions = new Set(applied.map(({ version }) => version));

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const existing = await transaction.getFirstAsync<AppliedMigrationRow>(
        'SELECT version FROM schema_migrations WHERE version = ?',
        migration.version
      );
      if (existing) {
        return;
      }

      await migration.up(transaction);
      await transaction.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    });
  }
}
