import type { SQLiteDatabase } from 'expo-sqlite';

// These are child tables with no inbound foreign keys in 001–011. The normal
// runner owns the exclusive transaction. Do not toggle foreign_keys inside it.
export const THREE_COGNITIVE_GAMES_SQL = `
  CREATE TABLE cognitive_sessions_v12 (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type IN ('memory_match', 'pattern_recognition', 'routine_recall', 'familiar_object', 'sequence_memory', 'picture_recall', 'remember_lights', 'number_path', 'sudoku_lite', 'chess_puzzle', 'word_match')),
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
      (game_type IN ('pattern_recognition', 'routine_recall', 'familiar_object', 'sequence_memory', 'picture_recall', 'remember_lights', 'number_path', 'sudoku_lite', 'chess_puzzle', 'word_match')
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
          AND steps_completed BETWEEN 2 AND 6 AND correct_selections = steps_completed AND challenges_completed IS NULL)
        OR (game_type = 'remember_lights' AND typeof(steps_completed) = 'integer'
          AND steps_completed = 2 * (difficulty + 1) AND correct_selections = steps_completed AND challenges_completed IS NULL)
        OR (game_type = 'number_path' AND typeof(steps_completed) = 'integer'
          AND steps_completed = CASE difficulty WHEN 1 THEN 5 WHEN 2 THEN 7 ELSE 10 END
          AND correct_selections = steps_completed AND challenges_completed IS NULL)
        OR (game_type = 'sudoku_lite' AND typeof(steps_completed) = 'integer'
          AND steps_completed = CASE difficulty WHEN 1 THEN 3 WHEN 2 THEN 6 WHEN 3 THEN 8 WHEN 4 THEN 12 ELSE 16 END
          AND correct_selections = steps_completed AND challenges_completed IS NULL)
        OR (game_type = 'chess_puzzle' AND typeof(steps_completed) = 'integer'
          AND steps_completed = CASE difficulty WHEN 1 THEN 6 WHEN 2 THEN 4 WHEN 3 THEN 4 ELSE 3 END
          AND correct_selections = steps_completed AND challenges_completed IS NULL)
        OR (game_type = 'word_match' AND typeof(steps_completed) = 'integer'
          AND steps_completed = CASE difficulty WHEN 1 THEN 3 WHEN 2 THEN 4 WHEN 3 THEN 4 WHEN 4 THEN 5 ELSE 6 END
          AND correct_selections = steps_completed AND challenges_completed IS NULL)))
    ),
    FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
  );
  INSERT INTO cognitive_sessions_v12 (
    rowid, id, patient_id, game_type, difficulty, started_at, completed_at, total_pairs, attempts, matches,
    hints_used, repeated_mistakes, avg_response_ms, accuracy, feedback_label, recommended_difficulty, is_demo_seed, created_at,
    challenges_completed, steps_completed, correct_selections, repeated_errors
  ) SELECT rowid, id, patient_id, game_type, difficulty, started_at, completed_at, total_pairs, attempts, matches,
    hints_used, repeated_mistakes, avg_response_ms, accuracy, feedback_label, recommended_difficulty, is_demo_seed, created_at,
    challenges_completed, steps_completed, correct_selections, repeated_errors FROM cognitive_sessions;
  DROP TABLE cognitive_sessions;
  ALTER TABLE cognitive_sessions_v12 RENAME TO cognitive_sessions;

  CREATE TABLE adaptive_model_state_v12 (
    patient_id TEXT NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type IN ('memory_match', 'pattern_recognition', 'routine_recall', 'familiar_object', 'sequence_memory', 'picture_recall', 'remember_lights', 'number_path', 'sudoku_lite', 'chess_puzzle', 'word_match')),
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
  INSERT INTO adaptive_model_state_v12 (
    rowid, patient_id, game_type, bias, weight_accuracy, weight_pace, weight_memory, weight_hints, weight_stability, sample_count, updated_at
  ) SELECT rowid, patient_id, game_type, bias, weight_accuracy, weight_pace, weight_memory, weight_hints, weight_stability, sample_count, updated_at
    FROM adaptive_model_state;
  DROP TABLE adaptive_model_state;
  ALTER TABLE adaptive_model_state_v12 RENAME TO adaptive_model_state;
`;

// The runner owns the exclusive transaction. No tables reference these two child tables.
// External triggers (including sync_initial_snapshot) reference them, so suspend and
// restore triggers inside that same transaction before the table rename is validated.
export const threeCognitiveGamesMigration = {
  version: 12,
  name: 'three_cognitive_games',
  async up(database: SQLiteDatabase) {
    const triggers = await database.getAllAsync<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY name"
    );
    const indexes = await database.getAllAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL
       AND tbl_name IN ('cognitive_sessions', 'adaptive_model_state') ORDER BY name`
    );
    for (const trigger of triggers) await database.execAsync('DROP TRIGGER "' + trigger.name.replaceAll('"', '""') + '"');
    await database.execAsync(THREE_COGNITIVE_GAMES_SQL);
    for (const index of indexes) await database.execAsync(index.sql);
    for (const trigger of triggers) await database.execAsync(trigger.sql);
    if ((await database.getAllAsync('PRAGMA foreign_key_check')).length) {
      throw new Error('Three cognitive games failed foreign key validation.');
    }
  },
} as const;
