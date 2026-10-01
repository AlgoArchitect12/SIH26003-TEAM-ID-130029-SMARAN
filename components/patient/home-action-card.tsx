import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';

import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { Layout, Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { useAppearance, useThemeColors } from '@/hooks/use-theme-color';

type HomeActionCardProps = {
  accessibilityHint: string;
  description: string;
  featured?: boolean;
  highContrast: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  imageSource?: number | string | ImageSource;
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
          borderWidth: contrast ? 3 : 1.5,
          overflow: 'hidden',
        },
      ]}>
      {featured ? (
        <View style={{ width: '100%', height: 176, position: 'relative' }}>
          {imageSource && (
            <View style={StyleSheet.absoluteFillObject}>
              <Image source={imageSource} accessible={false} aria-hidden contentFit="cover" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.actionSecondary, opacity: 0.5 }]} />
            </View>
          )}
          <View style={{ position: 'absolute', top: Spacing.sm, left: Spacing.sm, backgroundColor: colors.surfaceRaised, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
             <MaterialIcons name="psychology" size={16} color={colors.primary} />
             <ThemedText style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>Train My Mind</ThemedText>
          </View>
        </View>
      ) : (
        imageSource && <Image source={imageSource} accessible={false} aria-hidden contentFit="cover" style={{ width: '100%', height: 180, borderTopLeftRadius: Radius.card - 2, borderTopRightRadius: Radius.card - 2 }} />
      )}
      <View style={[featured ? styles.featuredContent : styles.row, { padding: featured ? Spacing.md : Spacing.md }]}>
      {!featured && <View
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
      </View>}
      <View style={styles.copy}>
        {featured && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <MaterialIcons name="verified" size={16} color={colors.surfaceMuted} />
          <ThemedText style={{ color: colors.surfaceMuted, fontSize: 12, fontWeight: 'bold' }}>Recommended by your adaptive guide</ThemedText>
        </View>}
        <ThemedText style={{ color: foreground }} textSize={textSize} type={featured ? 'cardHeading' : 'action'}>
          {title}
        </ThemedText>
        <ThemedText style={{ color: featured ? colors.surfaceMuted : colors.textSecondary }} textSize={textSize} type="secondary">
          {description}
        </ThemedText>
      </View>
      {featured ? <View style={[styles.featuredAction, { backgroundColor: colors.actionSecondary }]}>
        <MaterialIcons name="play-circle-outline" size={26} color={colors.onActionSecondary} accessible={false} aria-hidden />
        <ThemedText type="action" textSize={textSize} style={{ color: colors.onActionSecondary }}>{accessibilityHint}</ThemedText>
      </View> : <MaterialIcons name="arrow-forward" size={24} color={foreground} accessible={false} aria-hidden />}
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
  featuredContent: { gap: Spacing.md },
  featuredAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: Layout.minTouchTarget, padding: Spacing.sm, borderRadius: Radius.button },
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
