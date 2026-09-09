import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { Layout, Spacing } from '@constants/layout';
import { useThemeColors } from '@/hooks/use-theme-color';

type SelectionCardProps = {
  accessibilityLabel?: string;
  description?: string;
  disabled?: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  reducedMotionOverride?: boolean;
  selected: boolean;
  selectedLabel: string;
  title: string;
};

export function SelectionCard({
  accessibilityLabel,
  description,
  disabled = false,
  icon,
  onPress,
  reducedMotionOverride,
  selected,
  selectedLabel,
  title,
}: SelectionCardProps) {
  const colors = useThemeColors();

  return (
    <SmaranCard
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? `${title}. ${description ?? ''}`.trim()}
      onPress={onPress}
      reducedMotionOverride={reducedMotionOverride ?? null}
      selected={selected}
      padding={Spacing.md}
      style={styles.card}>
      <View style={styles.row}>
        <MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={colors.primary} name={icon} size={28} />
        <View style={styles.copy}>
          <ThemedText type="cardHeading">{title}</ThemedText>
          {description ? <ThemedText>{description}</ThemedText> : null}
          {selected ? (
            <View style={styles.selectedRow}>
              <MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={colors.success} name="check-circle" size={24} />
              <ThemedText type="secondary">{selectedLabel}</ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </SmaranCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: Layout.cardMinHeight,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  copy: {
    flex: 1,
    gap: Spacing.xs,
  },
  selectedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
