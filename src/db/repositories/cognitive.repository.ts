import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../client';
import type {
  ActivityFeedbackLabel,
  AdaptiveModelState,
  CognitiveSession,
  CompletedSessionInput,
  DifficultyLevel,
} from '../schema.types';
import { ActivityFeedbackLabels, DifficultyLevels } from '../schema.types';
import { validateRecordId } from '../../utils/validation';

type CognitiveSessionRow = {
  id: string;
  patient_id: string;
  game_type: 'memory_match';
  difficulty: DifficultyLevel;
  started_at: string;
  completed_at: string;
  total_pairs: number;
  attempts: number;
  matches: number;
  hints_used: number;
  repeated_mistakes: number;
  avg_response_ms: number;
  accuracy: number;
  feedback_label: ActivityFeedbackLabel | null;
  recommended_difficulty: DifficultyLevel;
  is_demo_seed: number;
  created_at: string;
};

type AdaptiveModelRow = {
  patient_id: string;
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
  return {
    id: row.id,
    patientId: row.patient_id,
    gameType: row.game_type,
    difficulty: row.difficulty,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    totalPairs: row.total_pairs,
    attempts: row.attempts,
    matches: row.matches,
    hintsUsed: row.hints_used,
    repeatedMistakes: row.repeated_mistakes,
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
  if (input.gameType !== 'memory_match') throw new Error('Unsupported activity type.');
  if (!isDifficulty(input.difficulty) || !isDifficulty(input.recommendedDifficulty)) {
    throw new Error('Activity difficulty must be between 1 and 5.');
  }
  if (!input.startedAt || !input.completedAt || input.completedAt < input.startedAt) {
    throw new Error('Activity timestamps are invalid.');
  }
  [input.totalPairs, input.attempts, input.matches, input.hintsUsed, input.repeatedMistakes].forEach(
    (value, index) => requireFinite(value, ['Pairs', 'Attempts', 'Matches', 'Hints', 'Repeated mistakes'][index])
  );
  if (
    !Number.isInteger(input.totalPairs) ||
    !Number.isInteger(input.attempts) ||
    !Number.isInteger(input.matches) ||
    !Number.isInteger(input.hintsUsed) ||
    !Number.isInteger(input.repeatedMistakes) ||
    input.totalPairs < 1 ||
    input.attempts < 1 ||
    input.matches !== input.totalPairs ||
    input.repeatedMistakes > input.attempts - input.matches
  ) {
    throw new Error('Completed activity counts are inconsistent.');
  }
  requireFinite(input.averageResponseMs, 'Average response time');
  requireFinite(input.accuracy, 'Accuracy');
  if (input.accuracy > 1) throw new Error('Accuracy must be between 0 and 1.');
  if (input.feedbackLabel !== null && !isFeedback(input.feedbackLabel)) {
    throw new Error('Activity feedback is invalid.');
  }
  return { ...input, patientId };
}

function validateModel(model: AdaptiveModelState) {
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
      feedback_label, recommended_difficulty, is_demo_seed, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    session.patientId,
    session.gameType,
    session.difficulty,
    session.startedAt,
    session.completedAt,
    session.totalPairs,
    session.attempts,
    session.matches,
    session.hintsUsed,
    session.repeatedMistakes,
    session.averageResponseMs,
    session.accuracy,
    session.feedbackLabel,
    session.recommendedDifficulty,
    createdAt
  );
  return id;
}

async function upsertModel(database: SQLiteDatabase, input: AdaptiveModelState) {
  const model = validateModel(input);
  await database.runAsync(
    `INSERT INTO adaptive_model_state (
      patient_id, bias, weight_accuracy, weight_pace, weight_memory, weight_hints,
      weight_stability, sample_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(patient_id) DO UPDATE SET
      bias = excluded.bias,
      weight_accuracy = excluded.weight_accuracy,
      weight_pace = excluded.weight_pace,
      weight_memory = excluded.weight_memory,
      weight_hints = excluded.weight_hints,
      weight_stability = excluded.weight_stability,
      sample_count = excluded.sample_count,
      updated_at = excluded.updated_at`,
    model.patientId,
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

async function getSessionById(id: string) {
  const row = await (await getDatabase()).getFirstAsync<CognitiveSessionRow>(
    `SELECT * FROM cognitive_sessions
     WHERE id = ? AND game_type = 'memory_match' AND is_demo_seed = 0`,
    validateRecordId(id, 'Session ID')
  );
  return row ? mapSession(row) : null;
}

async function getRecentSessions(patientId: string, limit = 5) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('Recent session limit must be an integer between 1 and 50.');
  }
  const rows = await (await getDatabase()).getAllAsync<CognitiveSessionRow>(
    `SELECT * FROM cognitive_sessions
     WHERE patient_id = ? AND game_type = 'memory_match' AND is_demo_seed = 0
     ORDER BY completed_at DESC LIMIT ?`,
    validateRecordId(patientId, 'Patient ID'),
    limit
  );
  return rows.map(mapSession);
}

async function getAdaptiveModel(patientId: string) {
  const row = await (await getDatabase()).getFirstAsync<AdaptiveModelRow>(
    'SELECT * FROM adaptive_model_state WHERE patient_id = ?',
    validateRecordId(patientId, 'Patient ID')
  );
  return row ? mapModel(row) : null;
}

async function saveCompletedSession(input: CompletedSessionInput, model?: AdaptiveModelState) {
  if (model && model.patientId !== input.patientId) {
    throw new Error('Activity session and model must belong to the same patient.');
  }

  const database = await getDatabase();
  let sessionId: string | null = null;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    sessionId = await insertSession(transaction, input);
    if (model) await upsertModel(transaction, model);
  });

  if (!sessionId) throw new Error('Completed activity could not be saved.');
  const saved = await database.getFirstAsync<CognitiveSessionRow>(
    'SELECT * FROM cognitive_sessions WHERE id = ?',
    sessionId
  );
  if (!saved) throw new Error('Completed activity could not be read after saving.');
  return mapSession(saved);
}

export const cognitiveRepository = {
  getAdaptiveModel,
  getRecentSessions,
  getSessionById,
  saveCompletedSession,
} as const;
