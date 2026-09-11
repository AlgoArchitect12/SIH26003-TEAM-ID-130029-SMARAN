import type { SQLiteDatabase } from 'expo-sqlite';

// These are child tables with no inbound foreign keys in 001–006. The normal
// runner owns the exclusive transaction. Do not toggle foreign_keys inside it.
export const COGNITIVE_AI_EXPANSION_SQL = `
  CREATE TABLE cognitive_sessions_v7 (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type IN ('memory_match', 'pattern_recognition', 'routine_recall', 'familiar_object', 'sequence_memory', 'picture_recall')),
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    total_pairs INTEGER,
    attempts INTEGER NOT NULL CHECK (attempts > 0),
    matches INTEGER,
    hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    repeated_mistakes INTEGER DEFAULT 0,
    avg_response_ms REAL NOT NULL CHECK (avg_response_ms >= 0),
    accuracy REAL NOT NULL CHECK (accuracy BETWEEN 0 AND 1),
    feedback_label TEXT CHECK (feedback_label IS NULL OR feedback_label IN ('easy', 'comfortable', 'challenging')),
    recommended_difficulty INTEGER NOT NULL CHECK (recommended_difficulty BETWEEN 1 AND 5),
    is_demo_seed INTEGER NOT NULL DEFAULT 0 CHECK (is_demo_seed IN (0, 1)),
    created_at TEXT NOT NULL,
    challenges_completed INTEGER,
    steps_completed INTEGER,
    correct_selections INTEGER,
    repeated_errors INTEGER,
    CHECK (
      (game_type = 'memory_match'
        AND total_pairs IS NOT NULL AND total_pairs > 0
        AND matches IS NOT NULL AND matches = total_pairs
        AND repeated_mistakes IS NOT NULL AND repeated_mistakes >= 0 AND repeated_mistakes <= attempts - matches
        AND challenges_completed IS NULL AND steps_completed IS NULL
        AND correct_selections IS NULL AND repeated_errors IS NULL)
      OR
      (game_type IN ('pattern_recognition', 'routine_recall', 'familiar_object', 'sequence_memory', 'picture_recall')
        AND total_pairs IS NULL AND matches IS NULL AND repeated_mistakes IS NULL
        AND typeof(attempts) = 'integer' AND typeof(hints_used) = 'integer'
        AND typeof(difficulty) = 'integer' AND typeof(recommended_difficulty) = 'integer'
        AND abs(recommended_difficulty - difficulty) <= 1
        AND typeof(correct_selections) = 'integer' AND correct_selections > 0 AND correct_selections <= attempts
        AND typeof(repeated_errors) = 'integer' AND repeated_errors >= 0 AND repeated_errors <= attempts - correct_selections
        AND abs(accuracy - 1.0 * correct_selections / attempts) < 0.000000001
        AND ((game_type IN ('pattern_recognition', 'familiar_object', 'picture_recall') AND typeof(challenges_completed) = 'integer'
          AND challenges_completed > 0 AND correct_selections = challenges_completed AND steps_completed IS NULL)
        OR (game_type = 'routine_recall' AND typeof(steps_completed) = 'integer'
          AND steps_completed BETWEEN 2 AND 5 AND correct_selections = steps_completed AND challenges_completed IS NULL)
        OR (game_type = 'sequence_memory' AND typeof(steps_completed) = 'integer'
          AND steps_completed BETWEEN 2 AND 6 AND correct_selections = steps_completed AND challenges_completed IS NULL)))
    ),
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
  );
  INSERT INTO cognitive_sessions_v7 (
    rowid, id, patient_id, game_type, difficulty, started_at, completed_at, total_pairs, attempts, matches,
    hints_used, repeated_mistakes, avg_response_ms, accuracy, feedback_label, recommended_difficulty, is_demo_seed, created_at,
    challenges_completed, steps_completed, correct_selections, repeated_errors
  ) SELECT rowid, id, patient_id, game_type, difficulty, started_at, completed_at, total_pairs, attempts, matches,
    hints_used, repeated_mistakes, avg_response_ms, accuracy, feedback_label, recommended_difficulty, is_demo_seed, created_at,
    challenges_completed, steps_completed, correct_selections, repeated_errors FROM cognitive_sessions;
  DROP TABLE cognitive_sessions;
  ALTER TABLE cognitive_sessions_v7 RENAME TO cognitive_sessions;

  CREATE TABLE adaptive_model_state_v7 (
    patient_id TEXT NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type IN ('memory_match', 'pattern_recognition', 'routine_recall', 'familiar_object', 'sequence_memory', 'picture_recall')),
    bias REAL NOT NULL,
    weight_accuracy REAL NOT NULL,
    weight_pace REAL NOT NULL,
    weight_memory REAL NOT NULL,
    weight_hints REAL NOT NULL,
    weight_stability REAL NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (patient_id, game_type),
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
  );
  INSERT INTO adaptive_model_state_v7 (
    rowid, patient_id, game_type, bias, weight_accuracy, weight_pace, weight_memory, weight_hints, weight_stability, sample_count, updated_at
  ) SELECT rowid, patient_id, game_type, bias, weight_accuracy, weight_pace, weight_memory, weight_hints, weight_stability, sample_count, updated_at
    FROM adaptive_model_state;
  DROP TABLE adaptive_model_state;
  ALTER TABLE adaptive_model_state_v7 RENAME TO adaptive_model_state;
`;

export const cognitiveAIExpansionMigration = {
  version: 7,
  name: 'cognitive_ai_expansion',
  async up(database: SQLiteDatabase) {
    // Preserve exact index definitions (including sort order/partial indexes).
    // Primary-key autoindexes are recreated by the table definitions themselves.
    const indexes = await database.getAllAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL
       AND tbl_name IN ('cognitive_sessions', 'adaptive_model_state') ORDER BY name`
    );
    await database.execAsync(COGNITIVE_AI_EXPANSION_SQL);
    for (const index of indexes) await database.execAsync(index.sql);
    const violations = await database.getAllAsync('PRAGMA foreign_key_check');
    if (violations.length) throw new Error('Cognitive AI expansion failed foreign key validation.');
  },
} as const;
