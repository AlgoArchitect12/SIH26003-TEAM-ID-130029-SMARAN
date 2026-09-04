import type { SQLiteDatabase } from 'expo-sqlite';

export const MULTILINGUAL_EXPANSION_SQL = `
  ALTER TABLE patient_settings RENAME TO patient_settings_before_multilingual;

  CREATE TABLE patient_settings (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL DEFAULT 'en' CHECK (
      language IN ('en', 'hi', 'as', 'bn', 'mni', 'kha', 'lus')
    ),
    region TEXT NOT NULL DEFAULT 'assam' CHECK (
      region IN ('assam', 'arunachal', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'sikkim', 'tripura')
    ),
    text_size TEXT NOT NULL DEFAULT 'large' CHECK (
      text_size IN ('standard', 'large', 'extra-large')
    ),
    high_contrast INTEGER NOT NULL DEFAULT 0 CHECK (high_contrast IN (0, 1)),
    voice_guidance INTEGER NOT NULL DEFAULT 1 CHECK (voice_guidance IN (0, 1)),
    reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
  );

  INSERT INTO patient_settings (
    id, patient_id, language, region, text_size,
    high_contrast, voice_guidance, reduced_motion, updated_at
  )
  SELECT
    id, patient_id, language, region, text_size,
    high_contrast, voice_guidance, reduced_motion, updated_at
  FROM patient_settings_before_multilingual;

  DROP TABLE patient_settings_before_multilingual;
`;

export const multilingualExpansionMigration = {
  version: 3,
  name: 'multilingual_expansion',
  async up(database: SQLiteDatabase) {
    await database.execAsync(MULTILINGUAL_EXPANSION_SQL);
  },
} as const;
