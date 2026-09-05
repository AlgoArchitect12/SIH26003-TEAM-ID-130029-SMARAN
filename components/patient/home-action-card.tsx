import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { useThemeColors } from '@/hooks/use-theme-color';

type HomeActionCardProps = {
  accessibilityHint: string;
  description: string;
  featured?: boolean;
  highContrast: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
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
  onPress,
  reducedMotion,
  textSize,
  title,
}: HomeActionCardProps) {
  const colors = useThemeColors();
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
          accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          color={featured ? colors.actionPrimary : colors.primary}
          name={icon}
          size={featured ? 40 : 36}
        />
      </View>
      <View style={styles.copy}>
        <ThemedText style={{ color: foreground, textTransform: 'uppercase' }} textSize={textSize} type="cardHeading">
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
    minHeight: 112,
  },
  featured: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    minHeight: 184,
  },
  icon: {
    alignItems: 'center',
    borderRadius: Radius.button,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  copy: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
});
