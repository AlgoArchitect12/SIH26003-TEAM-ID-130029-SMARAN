import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';

import type { TranslationKey } from '@i18n/index';

import type { MemorySymbolId } from './types';

export type MemorySymbol = {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  id: MemorySymbolId;
  labelKey: TranslationKey;
};

// Broadly familiar local icons keep this milestone offline and culturally neutral.
export const MemorySymbols: readonly MemorySymbol[] = [
  { icon: 'home', id: 'home', labelKey: 'symbolHome' },
  { icon: 'eco', id: 'leaf', labelKey: 'symbolLeaf' },
  { icon: 'local-florist', id: 'flower', labelKey: 'symbolFlower' },
  { icon: 'local-cafe', id: 'cup', labelKey: 'symbolCup' },
  { icon: 'wb-sunny', id: 'sun', labelKey: 'symbolSun' },
  { icon: 'music-note', id: 'music', labelKey: 'symbolMusic' },
  { icon: 'menu-book', id: 'book', labelKey: 'symbolBook' },
  { icon: 'favorite', id: 'heart', labelKey: 'symbolHeart' },
];

export function getMemorySymbol(id: MemorySymbolId) {
  const symbol = MemorySymbols.find((candidate) => candidate.id === id);
  if (!symbol) throw new Error(`Unknown memory symbol: ${id}`);
  return symbol;
}
