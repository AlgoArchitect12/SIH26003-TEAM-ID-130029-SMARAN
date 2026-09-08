/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { useAppearanceStore } from '@/src/stores/appearance.store';

export function useAppearance() {
  const system = useColorScheme() ?? 'light';
  const stored = useAppearanceStore(s => s.mode);
  const legacyContrast = useOnboardingStore(s => s.accessibility.highContrast);
  const mode = stored ?? (legacyContrast ? 'high-contrast-light' : 'system');
  return { mode, dark: mode === 'dark' || mode === 'high-contrast-dark' || (mode === 'system' && system === 'dark'),
    highContrast: mode.startsWith('high-contrast') };
}

export function useThemeColors() {
  const { dark, highContrast } = useAppearance();
  return highContrast ? (dark ? Colors.highContrastDark : Colors.highContrast) : (dark ? Colors.dark : Colors.light);
}

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const colors = useThemeColors();
  const theme = useAppearance().dark ? 'dark' : 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[colorName];
  }
}
