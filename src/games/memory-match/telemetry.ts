import type { MemorySymbolId } from './types';

export type MemoryTelemetryState = {
  attempts: number;
  decisionDurationsMs: readonly number[];
  firstFlipAtMs: number | null;
  hintsUsed: number;
  lastDecisionAtMs: number;
  matchedPairs: number;
  mismatchedPairKeys: readonly string[];
  repeatedMistakes: number;
  startedAtMs: number;
};

export type CompletedMemoryTelemetry = {
  gameType: 'memory_match';
  accuracy: number;
  attempts: number;
  averageResponseMs: number;
  completedAtMs: number;
  hintsUsed: number;
  idleTimeBeforeFirstFlipMs: number;
  matches: number;
  repeatedMistakes: number;
  startedAtMs: number;
  totalPairs: number;
};

export function createTelemetry(startedAtMs: number): MemoryTelemetryState {
  return {
    attempts: 0,
    decisionDurationsMs: [],
    firstFlipAtMs: null,
    hintsUsed: 0,
    lastDecisionAtMs: startedAtMs,
    matchedPairs: 0,
    mismatchedPairKeys: [],
    repeatedMistakes: 0,
    startedAtMs,
  };
}

export function recordFirstFlip(state: MemoryTelemetryState, nowMs: number): MemoryTelemetryState {
  return state.firstFlipAtMs === null ? { ...state, firstFlipAtMs: nowMs } : state;
}

export function recordHint(state: MemoryTelemetryState): MemoryTelemetryState {
  return { ...state, hintsUsed: state.hintsUsed + 1 };
}

/** An attempt is one completed two-card comparison. Response time is measured from
 * the previous actionable comparison boundary; app-background time is excluded by resumeTelemetry. */
export function recordComparison(
  state: MemoryTelemetryState,
  symbols: readonly [MemorySymbolId, MemorySymbolId],
  isMatch: boolean,
  nowMs: number
): MemoryTelemetryState {
  const duration = Math.max(0, nowMs - state.lastDecisionAtMs);
  const mismatchKey = [...symbols].sort().join('|');
  const wasRepeated = !isMatch && state.mismatchedPairKeys.includes(mismatchKey);
  return {
    ...state,
    attempts: state.attempts + 1,
    decisionDurationsMs: [...state.decisionDurationsMs, duration],
    lastDecisionAtMs: nowMs,
    matchedPairs: state.matchedPairs + Number(isMatch),
    mismatchedPairKeys:
      isMatch || state.mismatchedPairKeys.includes(mismatchKey)
        ? state.mismatchedPairKeys
        : [...state.mismatchedPairKeys, mismatchKey],
    repeatedMistakes: state.repeatedMistakes + Number(wasRepeated),
  };
}

export function resumeTelemetry(state: MemoryTelemetryState, nowMs: number): MemoryTelemetryState {
  return { ...state, lastDecisionAtMs: nowMs };
}

export function finalizeTelemetry(
  state: MemoryTelemetryState,
  totalPairs: number,
  completedAtMs: number
): CompletedMemoryTelemetry {
  const totalDecisionTime = state.decisionDurationsMs.reduce((total, value) => total + value, 0);
  return {
    gameType: 'memory_match',
    accuracy: state.attempts === 0 ? 0 : state.matchedPairs / state.attempts,
    attempts: state.attempts,
    averageResponseMs:
      state.decisionDurationsMs.length === 0
        ? 0
        : totalDecisionTime / state.decisionDurationsMs.length,
    completedAtMs,
    hintsUsed: state.hintsUsed,
    idleTimeBeforeFirstFlipMs:
      state.firstFlipAtMs === null ? 0 : Math.max(0, state.firstFlipAtMs - state.startedAtMs),
    matches: state.matchedPairs,
    repeatedMistakes: state.repeatedMistakes,
    startedAtMs: state.startedAtMs,
    totalPairs,
  };
}
