/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export function useThemeColors() {
  const theme = useColorScheme() ?? 'light';
  const highContrast = useOnboardingStore((state) => state.accessibility.highContrast);

  return highContrast ? Colors.highContrast : Colors[theme];
}

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const colors = useThemeColors();
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[colorName];
  }
}
