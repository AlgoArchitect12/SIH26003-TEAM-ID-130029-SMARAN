import type { TextSizePreference } from '@constants/typography';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export function useTextSize(): TextSizePreference {
  const size = useOnboardingStore((state) => state.accessibility.textSize);
  return size === 'standard' ? 'normal' : size === 'extra-large' ? 'extraLarge' : 'large';
}
