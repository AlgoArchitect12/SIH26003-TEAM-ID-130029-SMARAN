import type { SQLiteDatabase } from 'expo-sqlite';

import { coreBootstrapMigration } from './001_core_bootstrap';
import { cognitiveAdaptationMigration } from './002_cognitive_adaptation';
import { multilingualExpansionMigration } from './003_multilingual_expansion';
import { myDayMigration } from './004_my_day';
import { myMemoriesMigration } from './005_my_memories';
import { cognitiveExpansionMigration } from './006_cognitive_expansion';
import { cognitiveAIExpansionMigration } from './007_cognitive_ai_expansion';
import { authSyncMigration } from './008_auth_sync';
import { extraCognitiveGamesMigration } from './009_extra_cognitive_games';
import { careCircleReportsMigration } from './010_care_circle_reports';
import { syncConsentMigration } from './011_sync_consent';
import { threeCognitiveGamesMigration } from './012_three_cognitive_games';
import { reportDeliveryMigration } from './013_report_delivery';
import { patientLocationMigration } from './014_patient_location';
import { liveLocationMigration } from './015_live_location';

const migrations = [
  coreBootstrapMigration,
  cognitiveAdaptationMigration,
  multilingualExpansionMigration,
  myDayMigration,
  myMemoriesMigration,
  cognitiveExpansionMigration,
  cognitiveAIExpansionMigration,
  authSyncMigration,
  extraCognitiveGamesMigration,
  careCircleReportsMigration,
  syncConsentMigration,
  threeCognitiveGamesMigration,
  reportDeliveryMigration,
  patientLocationMigration,
  liveLocationMigration,
] as const;

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

// Bust cache
