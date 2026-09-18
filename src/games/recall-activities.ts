import { DifficultyLevels, type DifficultyLevel } from '../db/schema.types';
import type { TranslationKey } from '../i18n/index';
import { MemorySymbols } from './memory-match/assets';
import type { MemorySymbolId } from './memory-match/types';
import type { SelectionTask } from './selection-engine';

export type PictureTask = SelectionTask & { answer: MemorySymbolId; choices: readonly MemorySymbolId[] };
export type ObjectTask = PictureTask & { cue: TranslationKey };
export type RecallActivity = { preview: readonly MemorySymbolId[]; tasks: readonly PictureTask[] };

const objectCues = {
  home: 'objectHomeCue', leaf: 'objectLeafCue', flower: 'objectFlowerCue', cup: 'objectCupCue',
  sun: 'objectSunCue', book: 'objectBookCue',
} as const satisfies Partial<Record<MemorySymbolId, TranslationKey>>;
const objects = ['cup', 'book', 'home', 'flower', 'leaf', 'sun'] as const;
const rotate = <T,>(items: readonly T[], offset: number): T[] => [...items.slice(offset % items.length), ...items.slice(0, offset % items.length)];
function checkLevel(level: DifficultyLevel) {
  if (!DifficultyLevels.includes(level)) throw new Error('Invalid activity level.');
}

export function prepareFamiliarObjects(level: DifficultyLevel): readonly ObjectTask[] {
  checkLevel(level);
  return Array.from({ length: 5 }, (_, index) => {
    const pool = rotate(objects, (index + level) % objects.length).slice(0, level + 1);
    const answer = pool[0];
    return { id: `object-${level}-${index}`, answer, cue: objectCues[answer], choices: rotate(pool, index + 1) };
  });
}

// Patient-controlled previews: no countdown, hidden answer content during recall.
// Repeated symbols at higher levels require recalling order, not eliminating used choices.
export function prepareSequence(level: DifficultyLevel): RecallActivity {
  checkLevel(level);
  const pool = rotate(MemorySymbols.map(symbol => symbol.id), level).slice(0, Math.min(5, level + 1));
  const preview = [0, 1, 2, 0, 3, 1].slice(0, level + 1).map(index => pool[index]);
  return { preview, tasks: preview.map((answer, index) => ({
    id: `sequence-${level}-${index}`, answer, choices: rotate(pool, index + 1),
  })) };
}

export function preparePictures(level: DifficultyLevel): RecallActivity {
  checkLevel(level);
  const symbols = rotate(MemorySymbols.map(symbol => symbol.id), level + 1);
  const preview = symbols.slice(0, [2, 3, 4, 4, 5][level - 1]);
  const unseen = symbols.filter(symbol => !preview.includes(symbol));
  return { preview, tasks: [...preview].reverse().map((answer, index) => ({
    id: `picture-${level}-${index}`, answer,
    // Exactly one previously shown picture per question; all distractors were absent.
    choices: rotate([answer, ...rotate(unseen, index).slice(0, Math.min(3, level))], index + 1),
  })) };
}
