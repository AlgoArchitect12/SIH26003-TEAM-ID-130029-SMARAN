import type { SQLiteDatabase } from 'expo-sqlite';

export const COGNITIVE_ADAPTATION_SQL = `
  CREATE TABLE IF NOT EXISTS cognitive_sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type = 'memory_match'),
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    total_pairs INTEGER NOT NULL CHECK (total_pairs > 0),
    attempts INTEGER NOT NULL CHECK (attempts > 0),
    matches INTEGER NOT NULL CHECK (matches = total_pairs),
    hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    repeated_mistakes INTEGER NOT NULL DEFAULT 0 CHECK (
      repeated_mistakes >= 0 AND repeated_mistakes <= attempts - matches
    ),
    avg_response_ms REAL NOT NULL CHECK (avg_response_ms >= 0),
    accuracy REAL NOT NULL CHECK (accuracy BETWEEN 0 AND 1),
    feedback_label TEXT CHECK (
      feedback_label IS NULL OR feedback_label IN ('easy', 'comfortable', 'challenging')
    ),
    recommended_difficulty INTEGER NOT NULL CHECK (recommended_difficulty BETWEEN 1 AND 5),
    is_demo_seed INTEGER NOT NULL DEFAULT 0 CHECK (is_demo_seed IN (0, 1)),
    created_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_cognitive_sessions_patient_completed
    ON cognitive_sessions(patient_id, completed_at DESC);

  CREATE TABLE IF NOT EXISTS adaptive_model_state (
    patient_id TEXT PRIMARY KEY,
    bias REAL NOT NULL,
    weight_accuracy REAL NOT NULL,
    weight_pace REAL NOT NULL,
    weight_memory REAL NOT NULL,
    weight_hints REAL NOT NULL,
    weight_stability REAL NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
  );
`;

export const cognitiveAdaptationMigration = {
  version: 2,
  name: 'cognitive_adaptation',
  async up(database: SQLiteDatabase) {
    await database.execAsync(COGNITIVE_ADAPTATION_SQL);
  },
} as const;
