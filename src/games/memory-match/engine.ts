import { MemoryDifficulties } from './difficulty';
import { MemorySymbols } from './assets';
import type { FlipOutcome, MemoryCard, MemoryGameState } from './types';
import type { DifficultyLevel } from '@db/schema.types';

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createMemoryGame(
  difficulty: DifficultyLevel,
  random: () => number = Math.random
): MemoryGameState {
  const symbols = MemorySymbols.slice(0, MemoryDifficulties[difficulty].pairs);
  const cards = shuffle(
    symbols.flatMap(({ id }) => [
      { id: `${id}-a`, state: 'hidden' as const, symbolId: id },
      { id: `${id}-b`, state: 'hidden' as const, symbolId: id },
    ]),
    random
  );
  return { cards, firstCardIndex: null, hintedCardIds: [], inputLocked: true, status: 'IDLE' };
}

export function startPreview(state: MemoryGameState): MemoryGameState {
  if (state.status !== 'IDLE') return state;
  return { ...state, cards: state.cards.map((card) => ({ ...card, state: 'revealed' })), status: 'PREVIEW' };
}

export function startPlaying(state: MemoryGameState): MemoryGameState {
  if (state.status !== 'PREVIEW') return state;
  return {
    ...state,
    cards: state.cards.map((card) => ({ ...card, state: 'hidden' })),
    inputLocked: false,
    status: 'PLAYING',
  };
}

export function flipCard(state: MemoryGameState, index: number): FlipOutcome {
  const card = state.cards[index];
  if (
    state.status !== 'PLAYING' ||
    state.inputLocked ||
    !card ||
    card.state !== 'hidden'
  ) {
    return { comparedSymbols: null, isMatch: null, state };
  }

  const cards = state.cards.map((candidate, cardIndex) =>
    cardIndex === index ? { ...candidate, state: 'revealed' as const } : candidate
  );
  if (state.firstCardIndex === null) {
    return {
      comparedSymbols: null,
      isMatch: null,
      state: { ...state, cards, firstCardIndex: index },
    };
  }

  const first = cards[state.firstCardIndex];
  const isMatch = first.symbolId === card.symbolId;
  const comparedSymbols = [first.symbolId, card.symbolId] as const;
  if (!isMatch) {
    return {
      comparedSymbols,
      isMatch,
      state: { ...state, cards, inputLocked: true },
    };
  }

  const matchedCards: MemoryCard[] = cards.map((candidate, cardIndex) =>
    cardIndex === state.firstCardIndex || cardIndex === index
      ? { ...candidate, state: 'matched' }
      : candidate
  );
  const complete = matchedCards.every((candidate) => candidate.state === 'matched');
  return {
    comparedSymbols,
    isMatch,
    state: {
      ...state,
      cards: matchedCards,
      inputLocked: true,
      status: complete ? 'SESSION_COMPLETE' : 'MATCH_CELEBRATION',
    },
  };
}

export function resolveComparison(state: MemoryGameState): MemoryGameState {
  if (!state.inputLocked || state.firstCardIndex === null) return state;
  const cards = state.cards.map((card) =>
    card.state === 'revealed' ? { ...card, state: 'hidden' as const } : card
  );
  return {
    ...state,
    cards,
    firstCardIndex: null,
    inputLocked: false,
    status: state.status === 'SESSION_COMPLETE' ? 'SESSION_COMPLETE' : 'PLAYING',
  };
}

export function requestHint(state: MemoryGameState): MemoryGameState {
  if (
    state.status !== 'PLAYING' ||
    state.inputLocked ||
    state.firstCardIndex !== null ||
    state.hintedCardIds.length > 0
  ) return state;
  const firstUnmatched = state.cards.find((card) => card.state === 'hidden');
  if (!firstUnmatched) return state;
  const pair = state.cards.filter(
    (card) => card.symbolId === firstUnmatched.symbolId && card.state !== 'matched'
  );
  if (pair.length !== 2) return state;
  return { ...state, hintedCardIds: pair.map(({ id }) => id), inputLocked: true };
}

export function clearHint(state: MemoryGameState): MemoryGameState {
  if (state.hintedCardIds.length === 0) return state;
  return { ...state, hintedCardIds: [], inputLocked: false };
}
