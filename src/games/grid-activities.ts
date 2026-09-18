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

export function seededGridRandom(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Prepare once per session. A seed reproduces both target order and board positions.
export function prepareGridActivity(gameType: GridGame, level: DifficultyLevel, random: () => number = seededGridRandom(Date.now())): GridActivity {
  if (!DifficultyLevels.includes(level) || !['remember_lights', 'number_path'].includes(gameType)) throw new Error('Invalid grid activity.');
  if (gameType === 'remember_lights') {
    const tiles = ['1', '2', '3', '4'], roundLength = level + 1, rounds = 2;
    const tasks = Array.from({ length: roundLength * rounds }, (_, index) => ({
      id: `lights-${index}`, choices: tiles, answer: tiles[Math.floor(random() * tiles.length)],
    }));
    return { gameType, tasks, tiles, roundLength, rounds, presentationMs: 2400 - level * 200, showNext: false, markNext: false };
  }
  const count = [5, 7, 10, 10, 10][level - 1];
  const numbers = Array.from({ length: count }, (_, index) => String(index + 1));
  const middle = numbers.slice(1, -1);
  const tiles = [numbers[0], ...shuffle(middle, random), numbers[numbers.length - 1]];
  return {
    // L4 has two five-target rounds; L5 recalls one longer ten-target path.
    gameType, tiles, roundLength: level === 4 ? 5 : count, rounds: level === 4 ? 2 : 1,
    presentationMs: 0, showNext: true, markNext: level === 1,
    tasks: numbers.map((answer, index) => ({ id: `number-${index}`, choices: level >= 4 ? [numbers[0], ...shuffle(middle, random), numbers[numbers.length - 1]] : tiles, answer })),
  };
}
