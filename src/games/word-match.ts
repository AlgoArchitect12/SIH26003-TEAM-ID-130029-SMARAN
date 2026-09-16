import { DifficultyLevels, Regions, type DifficultyLevel, type Region } from '../db/schema.types';
import type { TranslationKey } from '../i18n/index';
import { shuffle } from './memory-match/engine';
import type { SelectionTask } from './selection-engine';

export type WordPair = { id: string; left: TranslationKey; right: TranslationKey; hint: TranslationKey };
export type WordActivity = { pairs: readonly WordPair[]; options: readonly WordPair[]; tasks: readonly SelectionTask[] };
export const wordPairCounts = [3, 4, 4, 5, 6] as const;
export const wordPairs: readonly WordPair[] = [
  { id: 'tea', left: 'wordTea', right: 'symbolCup', hint: 'wordTeaHint' },
  { id: 'rain', left: 'wordRain', right: 'wordUmbrella', hint: 'wordRainHint' },
  { id: 'book', left: 'symbolBook', right: 'wordRead', hint: 'wordBookHint' },
  { id: 'key', left: 'wordKey', right: 'wordDoor', hint: 'wordKeyHint' },
  { id: 'seed', left: 'wordSeed', right: 'wordPlant', hint: 'wordSeedHint' },
  { id: 'spoon', left: 'wordSpoon', right: 'wordMeal', hint: 'wordSpoonHint' },
  { id: 'fish', left: 'wordFish', right: 'wordRiver', hint: 'wordFishHint' },
  { id: 'drum', left: 'wordDrum', right: 'symbolMusic', hint: 'wordDrumHint' },
  { id: 'bamboo', left: 'wordBamboo', right: 'wordBasket', hint: 'wordBambooHint' },
  { id: 'shawl', left: 'wordShawl', right: 'wordWarm', hint: 'wordShawlHint' },
  { id: 'needle', left: 'wordNeedle', right: 'wordCloth', hint: 'wordNeedleHint' },
];
// Reuse PatientSettings.region and the regional content's tea, river, weaving and
// bamboo themes. These are familiar subjects, never assumptions about a person.
const regionalPair: Record<Region, string> = { assam: 'tea', arunachal: 'needle', manipur: 'fish', meghalaya: 'bamboo',
  mizoram: 'bamboo', nagaland: 'shawl', sikkim: 'shawl', tripura: 'bamboo' };
export function prepareWords(level: DifficultyLevel, region: Region, random: () => number = Math.random): WordActivity {
  if (!DifficultyLevels.includes(level) || !Regions.includes(region)) throw new Error('Invalid word activity.');
  const pool = wordPairs.slice(0, level <= 2 ? 4 : wordPairs.length);
  const local = level >= 3 ? pool.find(pair => pair.id === regionalPair[region]) : undefined;
  const pairs = [...(local ? [local] : []), ...shuffle(pool.filter(pair => pair !== local), random)].slice(0, wordPairCounts[level - 1]);
  const distractor = level === 3 ? wordPairs.find(pair => !pairs.includes(pair)) : undefined;
  const options = shuffle([...pairs, ...(distractor ? [distractor] : [])], random);
  return { pairs, options, tasks: pairs.map(pair => ({ id: pair.id, answer: pair.id, choices: options.map(option => option.id) })) };
}
