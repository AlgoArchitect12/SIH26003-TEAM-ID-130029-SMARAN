export type MemoryGameStatus =
  | 'IDLE'
  | 'PREVIEW'
  | 'PLAYING'
  | 'MATCH_CELEBRATION'
  | 'SESSION_COMPLETE';

export type MemoryCardState = 'hidden' | 'revealed' | 'matched';

export type MemorySymbolId =
  | 'home'
  | 'leaf'
  | 'flower'
  | 'cup'
  | 'sun'
  | 'music'
  | 'book'
  | 'heart';

export type MemoryCard = {
  id: string;
  state: MemoryCardState;
  symbolId: MemorySymbolId;
};

export type MemoryGameState = {
  cards: readonly MemoryCard[];
  firstCardIndex: number | null;
  hintedCardIds: readonly string[];
  inputLocked: boolean;
  status: MemoryGameStatus;
};

export type FlipOutcome = {
  comparedSymbols: readonly [MemorySymbolId, MemorySymbolId] | null;
  isMatch: boolean | null;
  state: MemoryGameState;
};
