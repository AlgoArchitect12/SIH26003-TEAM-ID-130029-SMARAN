import { DifficultyLevels, type DifficultyLevel } from '../db/schema.types';
import type { SelectionTask } from './selection-engine';

export const PatternShapes = ['circle', 'triangle', 'square', 'star'] as const;
export type PatternShape = (typeof PatternShapes)[number];
export type PatternChallenge = SelectionTask & {
  answer: PatternShape;
  choices: readonly PatternShape[];
  group: readonly PatternShape[];
  sequence: readonly PatternShape[];
};

// Repeated groups are also shown to the patient, so the intended continuation is explicit.
const groups: Record<DifficultyLevel, readonly (readonly number[])[]> = {
  1: [[0, 1]],
  2: [[0, 1], [0, 0, 1]],
  3: [[0, 1, 2], [0, 0, 1, 1]],
  4: [[0, 1, 2, 0], [0, 0, 1, 2]],
  5: [[0, 1, 0, 2, 3], [0, 0, 1, 2, 3]],
};
const choiceCounts: Record<DifficultyLevel, number> = { 1: 2, 2: 3, 3: 3, 4: 4, 5: 4 };

export function preparePatterns(level: DifficultyLevel): readonly PatternChallenge[] {
  if (!DifficultyLevels.includes(level)) throw new Error('Invalid activity level.');
  return Array.from({ length: 5 }, (_, index) => {
    const count = choiceCounts[level];
    const symbols = Array.from({ length: count }, (_, symbol) => PatternShapes[(symbol + index) % PatternShapes.length]);
    const group = groups[level][index % groups[level].length].map(symbol => symbols[symbol]);
    const shown = group.length * 2 + index % group.length;
    const sequence = Array.from({ length: shown }, (_, position) => group[position % group.length]);
    return {
      id: 'pattern-' + level + '-' + index, group, sequence, answer: group[shown % group.length],
      choices: [...symbols.slice(index % count), ...symbols.slice(0, index % count)],
    };
  });
}
