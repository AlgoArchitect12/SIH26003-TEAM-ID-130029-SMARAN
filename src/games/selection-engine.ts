import type { CognitiveActivityType } from '../db/schema.types';
import type { CompletedPatternTelemetry, CompletedRoutineTelemetry } from './telemetry';

export type SelectionTask = { id: string; choices: readonly string[]; answer: string };
export type SelectionState = {
  position: number;
  correctSelections: number;
  attempts: number;
  hintsUsed: number;
  repeatedErrors: number;
  errorKeys: readonly string[];
  durationsMs: readonly number[];
  startedAtMs: number;
  lastDecisionAtMs: number;
  completedAtMs: number | null;
  awaitingContinue: boolean;
  hintShown: boolean;
  feedback: 'retry' | 'correct' | null;
};

export function createSelection(tasks: readonly SelectionTask[], now: number): SelectionState {
  if (!tasks.length || new Set(tasks.map(task => task.id)).size !== tasks.length ||
    tasks.some(task => !task.id || !task.answer || !task.choices.length ||
      task.choices.some(choice => !choice.trim()) || new Set(task.choices).size !== task.choices.length ||
      task.choices.filter(choice => choice === task.answer).length !== 1)) {
    throw new Error('Activity content is invalid.');
  }
  return {
    position: 0, correctSelections: 0, attempts: 0, hintsUsed: 0, repeatedErrors: 0, errorKeys: [],
    durationsMs: [], startedAtMs: now, lastDecisionAtMs: now, completedAtMs: null,
    awaitingContinue: false, hintShown: false, feedback: null,
  };
}

export function chooseSelection(state: SelectionState, tasks: readonly SelectionTask[], choice: string, now: number): SelectionState {
  const task = tasks[state.position];
  if (!task || state.awaitingContinue || state.completedAtMs !== null || !task.choices.includes(choice)) return state;
  const correct = task.answer === choice, errorKey = task.id + ':' + choice;
  const repeated = !correct && state.errorKeys.includes(errorKey);
  return {
    ...state, correctSelections: state.correctSelections + Number(correct), attempts: state.attempts + 1,
    repeatedErrors: state.repeatedErrors + Number(repeated),
    errorKeys: correct || repeated ? state.errorKeys : [...state.errorKeys, errorKey],
    durationsMs: [...state.durationsMs, Math.max(0, now - state.lastDecisionAtMs)], lastDecisionAtMs: now,
    completedAtMs: correct && state.position === tasks.length - 1 ? now : null,
    awaitingContinue: correct, feedback: correct ? 'correct' : 'retry',
  };
}

export function hintSelection(state: SelectionState): SelectionState {
  return state.hintShown || state.awaitingContinue || state.completedAtMs !== null
    ? state : { ...state, hintsUsed: state.hintsUsed + 1, hintShown: true };
}

export function continueSelection(state: SelectionState, now: number): SelectionState {
  return !state.awaitingContinue || state.completedAtMs !== null ? state :
    { ...state, position: state.position + 1, awaitingContinue: false, hintShown: false, feedback: null, lastDecisionAtMs: now };
}

export function resumeSelection(state: SelectionState, now: number): SelectionState {
  return { ...state, lastDecisionAtMs: now };
}

export function finalizeSelection(state: SelectionState, gameType: Exclude<CognitiveActivityType, 'memory_match'>): CompletedPatternTelemetry | CompletedRoutineTelemetry {
  if (state.completedAtMs === null || !state.correctSelections || !state.attempts) throw new Error('Activity is not complete.');
  const common = {
    startedAtMs: state.startedAtMs, completedAtMs: state.completedAtMs, correctSelections: state.correctSelections,
    attempts: state.attempts, hintsUsed: state.hintsUsed, repeatedErrors: state.repeatedErrors,
    accuracy: state.correctSelections / state.attempts,
    averageResponseMs: state.durationsMs.reduce((sum, duration) => sum + duration, 0) / state.attempts,
  };
  return gameType === 'pattern_recognition'
    ? { ...common, gameType, challengesCompleted: state.correctSelections }
    : { ...common, gameType, stepsCompleted: state.correctSelections };
}
