import type { CognitiveActivityType } from '../db/schema.types';
import type { TranslationKey } from '../i18n/index';

// Deterministic, offline support rules. No diagnosis, generated advice or network.
export type CoachState = { wrongAnswers: number; hintLevel: 0 | 1 | 2 | 3 };
export const initialCoach: CoachState = { wrongAnswers: 0, hintLevel: 0 };

export function coachAnswer(state: CoachState, correct: boolean): CoachState {
  if (correct) return state;
  const wrongAnswers = state.wrongAnswers + 1;
  const automatic = wrongAnswers >= 3 ? 3 : wrongAnswers === 2 ? 1 : 0;
  return { wrongAnswers, hintLevel: Math.max(state.hintLevel, automatic) as CoachState['hintLevel'] };
}

export function coachHint(state: CoachState): CoachState {
  return state.hintLevel === 3 ? state : { ...state, hintLevel: (state.hintLevel + 1) as CoachState['hintLevel'] };
}

const hintKeys = {
  memory_match: ['coachMemoryHint', 'coachMemoryFocus'],
  pattern_recognition: ['coachPatternHint', 'coachPatternFocus'],
  routine_recall: ['coachRoutineHint', 'coachRoutineFocus'],
  familiar_object: ['coachObjectHint', 'coachObjectFocus'],
  sequence_memory: ['coachSequenceHint', 'coachSequenceFocus'],
  picture_recall: ['coachPictureHint', 'coachPictureFocus'],
} as const satisfies Record<CognitiveActivityType, readonly [TranslationKey, TranslationKey]>;

export function coachHintKey(game: CognitiveActivityType, state: CoachState): TranslationKey | null {
  if (!state.hintLevel) return null;
  if (state.hintLevel === 3) return game === 'memory_match' ? 'coachMemoryReveal' : 'coachReveal';
  return hintKeys[game][state.hintLevel - 1];
}
