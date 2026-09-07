import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../client';
import type {
  ActivityFeedbackLabel,
  AdaptiveModelState,
  CognitiveSession,
  CognitiveActivityType,
  CompletedSessionInput,
  DifficultyLevel,
} from '../schema.types';
import { ActivityFeedbackLabels, CognitiveActivityTypes, DifficultyLevels } from '../schema.types';
import { validateRecordId } from '../../utils/validation';

type CognitiveSessionRow = {
  id: string;
  patient_id: string;
  game_type: CognitiveActivityType;
  difficulty: DifficultyLevel;
  started_at: string;
  completed_at: string;
  total_pairs: number | null;
  attempts: number;
  matches: number | null;
  hints_used: number;
  repeated_mistakes: number | null;
  challenges_completed: number | null;
  steps_completed: number | null;
  correct_selections: number | null;
  repeated_errors: number | null;
  avg_response_ms: number;
  accuracy: number;
  feedback_label: ActivityFeedbackLabel | null;
  recommended_difficulty: DifficultyLevel;
  is_demo_seed: number;
  created_at: string;
};

type AdaptiveModelRow = {
  patient_id: string;
  game_type: CognitiveActivityType;
  bias: number;
  weight_accuracy: number;
  weight_pace: number;
  weight_memory: number;
  weight_hints: number;
  weight_stability: number;
  sample_count: number;
  updated_at: string;
};

function mapSession(row: CognitiveSessionRow): CognitiveSession {
  validateGameType(row.game_type);
  const metrics = row.game_type === 'memory_match'
    ? { gameType: row.game_type, totalPairs: requiredMetric(row.total_pairs), matches: requiredMetric(row.matches), repeatedMistakes: requiredMetric(row.repeated_mistakes) }
    : row.game_type === 'pattern_recognition'
      ? { gameType: row.game_type, challengesCompleted: requiredMetric(row.challenges_completed), correctSelections: requiredMetric(row.correct_selections), repeatedErrors: requiredMetric(row.repeated_errors) }
      : { gameType: row.game_type, stepsCompleted: requiredMetric(row.steps_completed), correctSelections: requiredMetric(row.correct_selections), repeatedErrors: requiredMetric(row.repeated_errors) };
  return {
    ...metrics,
    id: row.id,
    patientId: row.patient_id,
    difficulty: row.difficulty,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    attempts: row.attempts,
    hintsUsed: row.hints_used,
    averageResponseMs: row.avg_response_ms,
    accuracy: row.accuracy,
    feedbackLabel: row.feedback_label,
    recommendedDifficulty: row.recommended_difficulty,
    isDemoSeed: row.is_demo_seed === 1,
    createdAt: row.created_at,
  };
}

function mapModel(row: AdaptiveModelRow): AdaptiveModelState {
  return {
    patientId: row.patient_id,
    gameType: validateGameType(row.game_type),
    bias: row.bias,
    weights: {
      accuracy: row.weight_accuracy,
      pace: row.weight_pace,
      memory: row.weight_memory,
      hints: row.weight_hints,
      stability: row.weight_stability,
    },
    sampleCount: row.sample_count,
    updatedAt: row.updated_at,
  };
}

function requiredMetric(value: number | null) {
  if (value === null || !Number.isFinite(value)) throw new Error('Activity metrics are missing.');
  return value;
}

function validateGameType(value: CognitiveActivityType): CognitiveActivityType {
  if (!CognitiveActivityTypes.includes(value)) throw new Error('Unsupported activity type.');
  return value;
}

const supportedTypesSQL = `game_type IN (${CognitiveActivityTypes.map(() => '?').join(', ')})`;

function isDifficulty(value: number): value is DifficultyLevel {
  return DifficultyLevels.some((level) => level === value);
}

function isFeedback(value: string): value is ActivityFeedbackLabel {
  return ActivityFeedbackLabels.some((label) => label === value);
}

function requireFinite(value: number, label: string, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} must be a finite number of at least ${minimum}.`);
  }
}

function validateSession(input: CompletedSessionInput) {
  const patientId = validateRecordId(input.patientId, 'Patient ID');
  validateGameType(input.gameType);
  if (!isDifficulty(input.difficulty) || !isDifficulty(input.recommendedDifficulty)) {
    throw new Error('Activity difficulty must be between 1 and 5.');
  }
  if (!input.startedAt || !input.completedAt || input.completedAt < input.startedAt) {
    throw new Error('Activity timestamps are invalid.');
  }
  if (!Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(Date.parse(input.completedAt)) ||
    Math.abs(input.recommendedDifficulty - input.difficulty) > 1) throw new Error('Invalid activity timing or level change.');
  const completed = input.gameType === 'memory_match' ? input.totalPairs : input.gameType === 'pattern_recognition' ? input.challengesCompleted : input.stepsCompleted;
  const correct = input.gameType === 'memory_match' ? input.matches : input.correctSelections;
  const repeated = input.gameType === 'memory_match' ? input.repeatedMistakes : input.repeatedErrors;
  [completed, input.attempts, correct, input.hintsUsed, repeated].forEach(
    (value, index) => requireFinite(value, ['Completed items', 'Attempts', 'Correct selections', 'Hints', 'Repeated errors'][index])
  );
  if (
    !Number.isInteger(completed) ||
    !Number.isInteger(input.attempts) ||
    !Number.isInteger(correct) ||
    !Number.isInteger(input.hintsUsed) ||
    !Number.isInteger(repeated) ||
    completed < 1 ||
    input.attempts < 1 ||
    correct !== completed ||
    repeated > input.attempts - correct ||
    (input.gameType === 'routine_recall' && (completed < 2 || completed > 5))
  ) {
    throw new Error('Completed activity counts are inconsistent.');
  }
  requireFinite(input.averageResponseMs, 'Average response time');
  requireFinite(input.accuracy, 'Accuracy');
  if (input.accuracy > 1) throw new Error('Accuracy must be between 0 and 1.');
  if (input.gameType !== 'memory_match' && Math.abs(input.accuracy - correct / input.attempts) > 1e-9) {
    throw new Error('Activity accuracy does not match selections.');
  }
  if (input.feedbackLabel !== null && !isFeedback(input.feedbackLabel)) {
    throw new Error('Activity feedback is invalid.');
  }
  return { ...input, patientId };
}

function validateModel(model: AdaptiveModelState) {
  validateGameType(model.gameType);
  const patientId = validateRecordId(model.patientId, 'Patient ID');
  requireFinite(model.sampleCount, 'Model sample count');
  if (!Number.isInteger(model.sampleCount)) throw new Error('Model sample count must be an integer.');
  for (const value of [model.bias, ...Object.values(model.weights)]) {
    if (!Number.isFinite(value) || value < -2 || value > 2) {
      throw new Error('Activity model values must remain between -2 and 2.');
    }
  }
  return { ...model, patientId };
}

async function generateRecordId(database: SQLiteDatabase) {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();

  const row = await database.getFirstAsync<{ id: string }>(`
    SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2, 3) || '-8' ||
      substr(lower(hex(randomblob(2))), 2, 3) || '-' || lower(hex(randomblob(6))) AS id
  `);
  if (!row?.id) throw new Error('Could not generate a local activity ID.');
  return row.id;
}

async function insertSession(database: SQLiteDatabase, input: CompletedSessionInput) {
  const session = validateSession(input);
  const id = await generateRecordId(database);
  const createdAt = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO cognitive_sessions (
      id, patient_id, game_type, difficulty, started_at, completed_at, total_pairs,
      attempts, matches, hints_used, repeated_mistakes, avg_response_ms, accuracy,
      feedback_label, recommended_difficulty, is_demo_seed, created_at,
      challenges_completed, steps_completed, correct_selections, repeated_errors
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    id,
    session.patientId,
    session.gameType,
    session.difficulty,
    session.startedAt,
    session.completedAt,
    session.gameType === 'memory_match' ? session.totalPairs : null,
    session.attempts,
    session.gameType === 'memory_match' ? session.matches : null,
    session.hintsUsed,
    session.gameType === 'memory_match' ? session.repeatedMistakes : null,
    session.averageResponseMs,
    session.accuracy,
    session.feedbackLabel,
    session.recommendedDifficulty,
    createdAt,
    session.gameType === 'pattern_recognition' ? session.challengesCompleted : null,
    session.gameType === 'routine_recall' ? session.stepsCompleted : null,
    session.gameType === 'memory_match' ? null : session.correctSelections,
    session.gameType === 'memory_match' ? null : session.repeatedErrors
  );
  return id;
}

async function upsertModel(database: SQLiteDatabase, input: AdaptiveModelState) {
  const model = validateModel(input);
  await database.runAsync(
    `INSERT INTO adaptive_model_state (
      patient_id, game_type, bias, weight_accuracy, weight_pace, weight_memory, weight_hints,
      weight_stability, sample_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(patient_id, game_type) DO UPDATE SET
      bias = excluded.bias,
      weight_accuracy = excluded.weight_accuracy,
      weight_pace = excluded.weight_pace,
      weight_memory = excluded.weight_memory,
      weight_hints = excluded.weight_hints,
      weight_stability = excluded.weight_stability,
      sample_count = excluded.sample_count,
      updated_at = excluded.updated_at`,
    model.patientId,
    model.gameType,
    model.bias,
    model.weights.accuracy,
    model.weights.pace,
    model.weights.memory,
    model.weights.hints,
    model.weights.stability,
    model.sampleCount,
    model.updatedAt
  );
}

async function getSessionById(patientId: string, id: string) {
  const row = await (await getDatabase()).getFirstAsync<CognitiveSessionRow>(
    `SELECT * FROM cognitive_sessions
     WHERE patient_id = ? AND id = ? AND ${supportedTypesSQL} AND is_demo_seed = 0`,
    validateRecordId(patientId, 'Patient ID'), validateRecordId(id, 'Session ID'), ...CognitiveActivityTypes
  );
  return row ? mapSession(row) : null;
}

async function getRecentSessions(patientId: string, limit = 5, gameType?: CognitiveActivityType, before?: string) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('Recent session limit must be an integer between 1 and 50.');
  }
  if (gameType !== undefined) validateGameType(gameType);
  const rows = await (await getDatabase()).getAllAsync<CognitiveSessionRow>(
    `SELECT * FROM cognitive_sessions
     WHERE patient_id = ? AND ${supportedTypesSQL} AND is_demo_seed = 0
       ${gameType === undefined ? '' : 'AND game_type = ?'} ${before === undefined ? '' : 'AND completed_at < ?'}
     ORDER BY completed_at DESC LIMIT ?`,
    validateRecordId(patientId, 'Patient ID'),
    ...CognitiveActivityTypes,
    ...(gameType === undefined ? [] : [gameType]), ...(before === undefined ? [] : [before]),
    limit
  );
  return rows.map(mapSession);
}

async function getAdaptiveModel(patientId: string, gameType: CognitiveActivityType) {
  const row = await (await getDatabase()).getFirstAsync<AdaptiveModelRow>(
    'SELECT * FROM adaptive_model_state WHERE patient_id = ? AND game_type = ?',
    validateRecordId(patientId, 'Patient ID'), validateGameType(gameType)
  );
  return row ? mapModel(row) : null;
}

async function countSessions(patientId: string, start: Date, end: Date) {
  const row = await (await getDatabase()).getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM cognitive_sessions
     WHERE patient_id = ? AND ${supportedTypesSQL} AND is_demo_seed = 0
       AND completed_at >= ? AND completed_at < ?`,
    validateRecordId(patientId, 'Patient ID'), ...CognitiveActivityTypes, start.toISOString(), end.toISOString()
  );
  return row?.count ?? 0;
}

async function saveCompletedSession(input: CompletedSessionInput, model?: AdaptiveModelState) {
  if (model && (model.patientId !== input.patientId || model.gameType !== input.gameType)) {
    throw new Error('Activity session and model must belong to the same patient and activity.');
  }

  const database = await getDatabase();
  let saved: CognitiveSession | null = null;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    // Expo opens a separate transaction connection. Check ownership even when its FK pragma is off.
    const patient = await transaction.getFirstAsync('SELECT id FROM patient_profiles WHERE id = ?', validateRecordId(input.patientId, 'Patient ID'));
    if (!patient) throw new Error('Activity patient does not exist.');
    const sessionId = await insertSession(transaction, input);
    if (model) await upsertModel(transaction, model);
    const row = await transaction.getFirstAsync<CognitiveSessionRow>(
      'SELECT * FROM cognitive_sessions WHERE patient_id = ? AND id = ?', input.patientId, sessionId
    );
    if (!row) throw new Error('Completed activity could not be read after saving.');
    saved = mapSession(row);
  });

  if (!saved) throw new Error('Completed activity could not be saved.');
  return saved as CognitiveSession;
}

export const cognitiveRepository = {
  countSessions,
  getAdaptiveModel,
  getRecentSessions,
  getSessionById,
  saveCompletedSession,
} as const;
