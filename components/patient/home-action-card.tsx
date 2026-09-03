import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { Colors } from '@constants/colors';
import { Layout, Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { useColorScheme } from '@/hooks/use-color-scheme';

type HomeActionCardProps = {
  accessibilityHint: string;
  description: string;
  featured?: boolean;
  highContrast: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  label?: string;
  onPress: () => void;
  reducedMotion: boolean;
  textSize: TextSizePreference;
  title: string;
};

export function HomeActionCard({
  accessibilityHint,
  description,
  featured = false,
  highContrast,
  icon,
  label,
  onPress,
  reducedMotion,
  textSize,
  title,
}: HomeActionCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const foreground = featured ? colors.onActionPrimary : colors.text;

  return (
    <SmaranCard
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      padding={Spacing.lg}
      reducedMotionOverride={reducedMotion ? true : null}
      style={[
        styles.card,
        featured && styles.featured,
        {
          backgroundColor: featured ? colors.actionPrimary : colors.surface,
          borderColor: highContrast ? foreground : featured ? colors.actionPrimary : colors.border,
          borderWidth: highContrast ? 3 : featured ? 2 : 1,
        },
      ]}>
      <View
        style={[
          styles.icon,
          { backgroundColor: featured ? colors.surface : colors.surfaceMuted },
        ]}>
        <MaterialIcons
          color={featured ? colors.actionPrimary : colors.primary}
          name={icon}
          size={32}
        />
      </View>
      <View style={styles.copy}>
        {label ? (
          <ThemedText
            style={[styles.label, { color: foreground }]}
            textSize={textSize}
            type="secondary">
            {label}
          </ThemedText>
        ) : null}
        <ThemedText style={{ color: foreground }} textSize={textSize} type="cardHeading">
          {title}
        </ThemedText>
        <ThemedText style={{ color: foreground }} textSize={textSize}>
          {description}
        </ThemedText>
      </View>
    </SmaranCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: 120,
  },
  featured: {
    minHeight: 172,
  },
  icon: {
    alignItems: 'center',
    borderRadius: Radius.button,
    height: Layout.minTouchTarget,
    justifyContent: 'center',
    width: Layout.minTouchTarget,
  },
  copy: {
    flex: 1,
    gap: Spacing.xs,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
