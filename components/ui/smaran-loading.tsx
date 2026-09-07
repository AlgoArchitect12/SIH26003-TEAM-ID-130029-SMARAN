import { ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { Spacing } from '@constants/layout';
import { useThemeColors } from '@/hooks/use-theme-color';

export function SmaranLoading({ label }: { label: string }) {
  const colors = useThemeColors();
  return <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg }}>
    <ActivityIndicator color={colors.primary} size="large" />
    <ThemedText style={{ textAlign: 'center' }}>{label}</ThemedText>
  </View>;
}
