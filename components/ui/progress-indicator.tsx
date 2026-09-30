import { View } from 'react-native';
import { ThemedText } from '@components/themed-text';
import { useThemeColors } from '@/hooks/use-theme-color';

export function ProgressIndicator({ current, total, label }: { current: number; total: number; label: string }) {
  const colors = useThemeColors();
  const value = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
  return <View style={{ gap: 12 }} accessible accessibilityRole="progressbar" accessibilityLiveRegion="polite"
    accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
    <ThemedText type="secondary">{label}</ThemedText>
    <View style={{ height: 8, borderRadius: 8, backgroundColor: colors.divider, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${value * 100}%`, borderRadius: 8, backgroundColor: colors.primary }} />
    </View>
  </View>;
}
