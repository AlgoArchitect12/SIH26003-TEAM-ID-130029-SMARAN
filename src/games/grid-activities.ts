import { DifficultyLevels, type DifficultyLevel } from '../db/schema.types';
import { shuffle } from './memory-match/engine';
import type { SelectionTask } from './selection-engine';

export type GridGame = 'remember_lights' | 'number_path';
export type GridActivity = {
  gameType: GridGame;
  tasks: readonly SelectionTask[];
  tiles: readonly string[];
  roundLength: number;
  rounds: number;
  presentationMs: number;
  showNext: boolean;
  markNext: boolean;
};

// Inject the random source in regression checks; production uses fresh offline rounds.
export function prepareGridActivity(gameType: GridGame, level: DifficultyLevel, random: () => number = Math.random): GridActivity {
  if (!DifficultyLevels.includes(level) || !['remember_lights', 'number_path'].includes(gameType)) throw new Error('Invalid grid activity.');
  if (gameType === 'remember_lights') {
    const tiles = ['1', '2', '3', '4'], roundLength = level + 1, rounds = 2;
    const tasks = Array.from({ length: roundLength * rounds }, (_, index) => ({
      id: `lights-${index}`, choices: tiles, answer: tiles[Math.floor(random() * tiles.length)],
    }));
    return { gameType, tasks, tiles, roundLength, rounds, presentationMs: 1900 - level * 100, showNext: false, markNext: false };
  }
  const roundLength = [5, 7, 10, 10, 10][level - 1];
  const numbers = Array.from({ length: roundLength }, (_, index) => String(index + 1));
  const groupSize = [2, 3, 4, 10, 10][level - 1];
  const tiles = numbers.flatMap((_, index) => index % groupSize === 0 ? shuffle(numbers.slice(index, index + groupSize), random) : []);
  return {
    gameType, tiles, roundLength, rounds: 1, presentationMs: 0, showNext: level <= 4, markNext: level === 1,
    tasks: numbers.map((answer, index) => ({ id: `number-${index}`, choices: tiles, answer })),
  };
}
