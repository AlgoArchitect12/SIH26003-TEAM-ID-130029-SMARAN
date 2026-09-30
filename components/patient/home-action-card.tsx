import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { useAppearance, useThemeColors } from '@/hooks/use-theme-color';

type HomeActionCardProps = {
  accessibilityHint: string;
  description: string;
  featured?: boolean;
  highContrast: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  imageSource?: ImageSourcePropType;
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
  imageSource,
  onPress,
  reducedMotion,
  textSize,
  title,
}: HomeActionCardProps) {
  const colors = useThemeColors();
  const contrast = useAppearance().highContrast || highContrast;
  const foreground = featured ? colors.onActionPrimary : colors.text;

  return (
    <SmaranCard
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      padding={0}
      reducedMotionOverride={reducedMotion ? true : null}
      style={[
        styles.card,
        featured && styles.featured,
        {
          backgroundColor: featured ? colors.actionPrimary : colors.surfaceRaised,
          borderColor: contrast ? foreground : featured ? colors.actionPrimary : colors.border,
          borderWidth: contrast ? 3 : 2,
        },
      ]}>
      {imageSource && <Image source={imageSource} accessible={false} aria-hidden resizeMode="cover"
        style={{ width: '100%', height: 180, borderTopLeftRadius: Radius.card - 2, borderTopRightRadius: Radius.card - 2 }} />}
      <View style={[styles.row, { padding: featured ? Spacing.lg : Spacing.md }]}>
      <View
        style={[
          styles.icon,
          { backgroundColor: featured ? colors.surface : colors.surfaceSelected },
        ]}>
        <MaterialIcons
          accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          color={featured ? colors.actionPrimary : colors.primary}
          name={icon}
          size={featured ? 36 : 28}
        />
      </View>
      <View style={styles.copy}>
        <ThemedText style={{ color: foreground }} textSize={textSize} type={featured ? 'cardHeading' : 'action'}>
          {title}
        </ThemedText>
        <ThemedText style={{ color: featured ? foreground : colors.textSecondary }} textSize={textSize} type="secondary">
          {description}
        </ThemedText>
      </View>
      <MaterialIcons name="arrow-forward" size={24} color={foreground} accessible={false} aria-hidden />
      </View>
    </SmaranCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  featured: {
    minHeight: 156,
  },
  icon: {
    alignItems: 'center',
    borderRadius: Radius.button,
    height: 52,
    flexShrink: 0,
    justifyContent: 'center',
    width: 52,
  },
  copy: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
});
