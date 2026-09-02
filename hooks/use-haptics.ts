import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

export function useHaptics(enabled = true) {
  return useCallback(async () => {
    if (!enabled) {
      return;
    }

    try {
      await Haptics.selectionAsync();
    } catch (error) {
      if (__DEV__) {
        console.warn('Haptic feedback unavailable', error);
      }
    }
  }, [enabled]);
}
