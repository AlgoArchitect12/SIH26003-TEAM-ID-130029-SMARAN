import { MaterialIcons } from '@expo/vector-icons';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { Spacing } from '@constants/layout';
import { useThemeColors } from '@/hooks/use-theme-color';

export function SmaranLoading({ label }: { label: string }) {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();
  return <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg }}>
    {reducedMotion ? <MaterialIcons name="hourglass-empty" color={colors.primary} size={32} accessible={false} aria-hidden /> : <ActivityIndicator color={colors.primary} size="large" />}
    <ThemedText style={{ textAlign: 'center' }}>{label}</ThemedText>
  </View>;
}
