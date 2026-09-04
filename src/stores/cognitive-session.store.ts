import { create } from 'zustand';

import type { PendingCognitiveSession, SavedCognitiveResult } from '@ai/types';

type CognitiveSessionState = {
  pending: PendingCognitiveSession | null;
  saved: SavedCognitiveResult | null;
  clear: () => void;
  setPending: (pending: PendingCognitiveSession) => void;
  setSaved: (saved: SavedCognitiveResult) => void;
};

export const useCognitiveSessionStore = create<CognitiveSessionState>()((set) => ({
  pending: null,
  saved: null,
  clear: () => set({ pending: null, saved: null }),
  setPending: (pending) => set({ pending, saved: null }),
  setSaved: (saved) => set({ pending: null, saved }),
}));
