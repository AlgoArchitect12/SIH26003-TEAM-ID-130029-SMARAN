import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { Colors } from '@constants/colors';
import { Layout, Spacing } from '@constants/layout';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SelectionCardProps = {
  accessibilityLabel?: string;
  description?: string;
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
  icon,
  onPress,
  reducedMotionOverride,
  selected,
  selectedLabel,
  title,
}: SelectionCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <SmaranCard
      accessibilityLabel={accessibilityLabel ?? `${title}. ${description ?? ''}`.trim()}
      onPress={onPress}
      reducedMotionOverride={reducedMotionOverride ?? null}
      selected={selected}
      style={styles.card}>
      <View style={styles.row}>
        <MaterialIcons color={colors.primary} name={icon} size={32} />
        <View style={styles.copy}>
          <ThemedText type="cardHeading">{title}</ThemedText>
          {description ? <ThemedText>{description}</ThemedText> : null}
          {selected ? (
            <View style={styles.selectedRow}>
              <MaterialIcons color={colors.success} name="check-circle" size={22} />
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
