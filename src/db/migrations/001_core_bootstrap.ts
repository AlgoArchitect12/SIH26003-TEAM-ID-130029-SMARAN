import type { SQLiteDatabase } from 'expo-sqlite';

export const coreBootstrapMigration = {
  version: 1,
  name: 'core_bootstrap',
  async up(database: SQLiteDatabase) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS patient_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        preferred_name TEXT NOT NULL,
        age_bracket TEXT CHECK (age_bracket IS NULL OR age_bracket IN ('60-70', '70-80', '80+')),
        emergency_name TEXT,
        emergency_phone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS patient_settings (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL UNIQUE,
        language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'as')),
        region TEXT NOT NULL DEFAULT 'assam' CHECK (
          region IN ('assam', 'arunachal', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'sikkim', 'tripura')
        ),
        text_size TEXT NOT NULL DEFAULT 'large' CHECK (text_size IN ('standard', 'large', 'extra-large')),
        high_contrast INTEGER NOT NULL DEFAULT 0 CHECK (high_contrast IN (0, 1)),
        voice_guidance INTEGER NOT NULL DEFAULT 1 CHECK (voice_guidance IN (0, 1)),
        reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
        updated_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
      );
    `);
  },
} as const;
