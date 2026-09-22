import type { DifficultyLevel } from '@db/schema.types';

export type MemoryDifficulty = {
  columns: number;
  minimumCardSize: number;
  pairs: number;
};

export const MemoryDifficulties: Record<DifficultyLevel, MemoryDifficulty> = {
  1: { columns: 2, minimumCardSize: 72, pairs: 2 },
  2: { columns: 3, minimumCardSize: 72, pairs: 3 },
  3: { columns: 4, minimumCardSize: 72, pairs: 4 },
  4: { columns: 4, minimumCardSize: 56, pairs: 6 },
  5: { columns: 4, minimumCardSize: 56, pairs: 8 },
};

export const INITIAL_MEMORY_DIFFICULTY: DifficultyLevel = 1;
