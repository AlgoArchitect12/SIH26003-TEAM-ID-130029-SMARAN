import { DifficultyLevels, type DifficultyLevel } from '../db/schema.types';
import { shuffle } from './memory-match/engine';
import type { SelectionTask } from './selection-engine';

export type SudokuPuzzle = {
  size: 4 | 6; regionWidth: number; clues: readonly number[]; solution: readonly number[];
  tasks: readonly SelectionTask[];
};
export const sudokuBlankCounts = [3, 6, 8, 12, 16] as const;
// Original masks. Every blank can be solved by successive single candidates.
const masks = [
  [3, 10, 1], [3, 10, 1, 8, 15, 6],
  [3, 10, 17, 24, 31, 2, 9, 16],
  [3, 10, 17, 24, 31, 2, 9, 16, 23, 30, 1, 8],
  [3, 10, 17, 24, 31, 2, 9, 16, 23, 30, 1, 8, 15, 22, 29, 0],
] as const;

export function sudokuPeers(size: number, a: number, b: number) {
  return Math.floor(a / size) === Math.floor(b / size) || a % size === b % size ||
    (Math.floor(a / (size * 2)) === Math.floor(b / (size * 2)) && Math.floor((a % size) / (size / 2)) === Math.floor((b % size) / (size / 2)));
}
export function sudokuCandidates(board: readonly number[], size: number, cell: number) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= board.length || board[cell]) return [];
  return Array.from({ length: size }, (_, i) => i + 1).filter(n =>
    !board.some((value, other) => value === n && sudokuPeers(size, cell, other)));
}

// Also verifies uniqueness: each step is forced, until the complete solution is reached.
export function validateSudoku(puzzle: Pick<SudokuPuzzle, 'size' | 'clues' | 'solution'>): number[] {
  const { size, clues, solution } = puzzle;
  if (![4, 6].includes(size) || clues.length !== size * size || solution.length !== clues.length ||
    solution.some((n, i) => !Number.isInteger(n) || n < 1 || n > size ||
      solution.some((v, j) => i !== j && n === v && sudokuPeers(size, i, j))) ||
    clues.some((n, i) => n !== 0 && n !== solution[i])) throw new Error('Invalid Sudoku content.');
  const board = [...clues], order: number[] = [];
  while (board.includes(0)) {
    const cell = board.findIndex((n, i) => n === 0 && sudokuCandidates(board, size, i).length === 1);
    if (cell < 0) throw new Error('Sudoku requires more than single-candidate reasoning.');
    board[cell] = sudokuCandidates(board, size, cell)[0]; order.push(cell);
  }
  if (board.some((n, i) => n !== solution[i])) throw new Error('Sudoku solution mismatch.');
  return order;
}

export function prepareSudoku(level: DifficultyLevel, random: () => number = Math.random): SudokuPuzzle {
  if (!DifficultyLevels.includes(level)) throw new Error('Invalid Sudoku level.');
  const size = level <= 2 ? 4 : 6, regionWidth = size / 2;
  const digits = shuffle(Array.from({ length: size }, (_, i) => i + 1), random);
  const mirror = random() < 0.5;
  const original = Array.from({ length: size * size }, (_, i) =>
    digits[(Math.floor(i / size) * regionWidth + Math.floor(Math.floor(i / size) / 2) + i % size) % size]);
  const transform = (i: number) => mirror ? Math.floor(i / size) * size + size - 1 - i % size : i;
  const solution = original.map((_, i) => original[transform(i)]);
  const blanks: readonly number[] = masks[level - 1];
  const clues = solution.map((n, i) => blanks.includes(transform(i)) ? 0 : n);
  const order = validateSudoku({ size, clues, solution });
  const choices = Array.from({ length: size }, (_, i) => String(i + 1));
  return { size, regionWidth, clues, solution,
    tasks: order.map(cell => ({ id: String(cell), answer: String(solution[cell]), choices })) };
}
