import { DifficultyLevels, type DifficultyLevel } from '../db/schema.types';
import type { SelectionTask } from './selection-engine';

export type RoutineStep = { id: string; text: string };
export type Routine = { id: string; title: string; steps: readonly RoutineStep[] };

// Harmless pretend activities. The preview defines the order; no safety-critical instructions.
// English bodies are explicit in the UI and speech. Native-speaker content review is still needed.
export const Routines: Record<DifficultyLevel, Routine> = {
  1: { id: 'book-bag', title: 'A book in a bag', steps: [
    { id: 'open-bag', text: 'Open the empty bag.' }, { id: 'book-inside', text: 'Put a book inside the open bag.' },
  ] },
  2: { id: 'fold-towel', title: 'Putting away a towel', steps: [
    { id: 'pick-towel', text: 'Pick up a towel.' }, { id: 'fold-towel', text: 'Fold the towel.' },
    { id: 'store-towel', text: 'Put the folded towel on a shelf.' },
  ] },
  3: { id: 'pencil-box', title: 'Putting away a pencil', steps: [
    { id: 'open-box', text: 'Open the empty box.' }, { id: 'pencil-inside', text: 'Put a pencil in the open box.' },
    { id: 'close-box', text: 'Close the box.' }, { id: 'store-box', text: 'Put the closed box on a shelf.' },
  ] },
  4: { id: 'picture-envelope', title: 'Keeping a picture', steps: [
    { id: 'choose-picture', text: 'Choose a picture.' }, { id: 'open-envelope', text: 'Open an empty envelope.' },
    { id: 'picture-inside', text: 'Put the picture in the envelope.' }, { id: 'close-envelope', text: 'Close the envelope.' },
  ] },
  5: { id: 'pack-bag', title: 'Preparing a bag', steps: [
    { id: 'bag-on-table', text: 'Put an empty bag on the table.' }, { id: 'unzip-bag', text: 'Open the bag.' },
    { id: 'put-book', text: 'Put a book inside the bag.' }, { id: 'zip-bag', text: 'Close the bag.' },
    { id: 'bag-on-chair', text: 'Place the closed bag on a chair.' },
  ] },
};

export function prepareRoutine(level: DifficultyLevel): { routine: Routine; tasks: readonly SelectionTask[] } {
  if (!DifficultyLevels.includes(level)) throw new Error('Invalid activity level.');
  const routine = Routines[level];
  return {
    routine,
    tasks: routine.steps.map((step, index) => {
      const remaining = routine.steps.slice(index).map(value => value.id);
      return { id: routine.id + '-' + index, answer: step.id, choices: [...remaining.slice(1).reverse(), remaining[0]] };
    }),
  };
}
