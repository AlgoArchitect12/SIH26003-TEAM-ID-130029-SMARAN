import type { CognitiveActivityType } from '../db/schema.types';
import type { CompletedSelectionTelemetry } from './telemetry';
import { coachAnswer, coachHint, initialCoach, type CoachState } from '../ai/cognitive-coach';

export type SelectionTask = { id: string; choices: readonly string[]; answer: string };
export type SelectionState = CoachState & {
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
  feedback: 'retry' | 'correct' | null;
  lastChoice: string | null;
};

export type AnswerFeedback = 'correct' | 'wrong' | null;

// Pure mapping so every board paints the same accessible correct/wrong state.
// Correct highlights the answer; wrong highlights only the tapped distractor.
export function answerFeedbackFor(choice: string, answer: string,
  selection: Pick<SelectionState, 'feedback' | 'lastChoice'>): AnswerFeedback {
  if (selection.feedback === 'correct' && choice === answer) return 'correct';
  if (selection.feedback === 'retry' && choice === selection.lastChoice) return 'wrong';
  return null;
}

export function createSelection(tasks: readonly SelectionTask[], now: number): SelectionState {
  if (!tasks.length || new Set(tasks.map(task => task.id)).size !== tasks.length ||
    tasks.some(task => !task.id || !task.answer || !task.choices.length ||
      task.choices.some(choice => !choice.trim()) || new Set(task.choices).size !== task.choices.length ||
      task.choices.filter(choice => choice === task.answer).length !== 1)) {
    throw new Error('Activity content is invalid.');
  }
  return {
    ...initialCoach,
    position: 0, correctSelections: 0, attempts: 0, hintsUsed: 0, repeatedErrors: 0, errorKeys: [],
    durationsMs: [], startedAtMs: now, lastDecisionAtMs: now, completedAtMs: null,
    awaitingContinue: false, feedback: null, lastChoice: null,
  };
}

export function chooseSelection(state: SelectionState, tasks: readonly SelectionTask[], choice: string, now: number): SelectionState {
  const task = tasks[state.position];
  if (!task || state.awaitingContinue || state.completedAtMs !== null || !task.choices.includes(choice) ||
    (state.hintLevel === 3 && choice !== task.answer)) return state;
  const correct = task.answer === choice, errorKey = task.id + ':' + choice;
  const repeated = !correct && state.errorKeys.includes(errorKey);
  const coach = coachAnswer(state, correct);
  return {
    ...state, ...coach, hintsUsed: state.hintsUsed + Number(coach.hintLevel > state.hintLevel),
    correctSelections: state.correctSelections + Number(correct), attempts: state.attempts + 1,
    repeatedErrors: state.repeatedErrors + Number(repeated),
    errorKeys: correct || repeated ? state.errorKeys : [...state.errorKeys, errorKey],
    durationsMs: [...state.durationsMs, Math.max(0, now - state.lastDecisionAtMs)], lastDecisionAtMs: now,
    completedAtMs: correct && state.position === tasks.length - 1 ? now : null,
    awaitingContinue: correct, feedback: correct ? 'correct' : 'retry', lastChoice: choice,
  };
}

export function hintSelection(state: SelectionState): SelectionState {
  if (state.hintLevel === 3 || state.awaitingContinue || state.completedAtMs !== null) return state;
  return { ...state, ...coachHint(state), hintsUsed: state.hintsUsed + 1 };
}

export function continueSelection(state: SelectionState, now: number): SelectionState {
  return !state.awaitingContinue || state.completedAtMs !== null ? state :
    { ...state, ...initialCoach, position: state.position + 1, awaitingContinue: false, feedback: null, lastChoice: null, lastDecisionAtMs: now };
}

export function resumeSelection(state: SelectionState, now: number): SelectionState {
  return { ...state, lastDecisionAtMs: now };
}

export function finalizeSelection(state: SelectionState, gameType: Exclude<CognitiveActivityType, 'memory_match'>): CompletedSelectionTelemetry {
  if (state.completedAtMs === null || !state.correctSelections || !state.attempts) throw new Error('Activity is not complete.');
  const common = {
    startedAtMs: state.startedAtMs, completedAtMs: state.completedAtMs, correctSelections: state.correctSelections,
    attempts: state.attempts, hintsUsed: state.hintsUsed, repeatedErrors: state.repeatedErrors,
    accuracy: state.correctSelections / state.attempts,
    averageResponseMs: state.durationsMs.reduce((sum, duration) => sum + duration, 0) / state.attempts,
  };
  return gameType === 'routine_recall' || gameType === 'sequence_memory' || gameType === 'remember_lights' || gameType === 'number_path' ||
    gameType === 'sudoku_lite' || gameType === 'chess_puzzle' || gameType === 'word_match'
    ? { ...common, gameType, stepsCompleted: state.correctSelections }
    : { ...common, gameType, challengesCompleted: state.correctSelections };
}
