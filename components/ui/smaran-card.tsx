import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors } from '@constants/colors';
import { Elevation, Layout, Radius, Spacing } from '@constants/layout';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHaptics } from '@/hooks/use-haptics';
import { type ReducedMotionOverride, useReducedMotion } from '@/hooks/use-reduced-motion';

type BaseCardProps = {
  accessibilityHint?: string;
  disabled?: boolean;
  hapticsEnabled?: boolean;
  padding?: number;
  reducedMotionOverride?: ReducedMotionOverride;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type InteractiveCardProps = {
  accessibilityLabel: string;
  onPress: (event: GestureResponderEvent) => void;
};

type StaticCardProps = {
  accessibilityLabel?: string;
  onPress?: undefined;
};

export type SmaranCardProps = PropsWithChildren<
  BaseCardProps & (InteractiveCardProps | StaticCardProps)
>;

export function SmaranCard({
  accessibilityHint,
  accessibilityLabel,
  children,
  disabled = false,
  hapticsEnabled = true,
  onPress,
  padding = Spacing.lg,
  reducedMotionOverride = null,
  style,
  testID,
}: SmaranCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion(reducedMotionOverride);
  const triggerHaptic = useHaptics(hapticsEnabled && !disabled);
  const cardStyle = [
    styles.card,
    Elevation.card,
    { backgroundColor: colors.surface, borderColor: colors.border, padding },
    style,
  ];

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={cardStyle} testID={testID}>
        {children}
      </View>
    );
  }

  const handlePress = (event: GestureResponderEvent) => {
    void triggerHaptic();
    onPress(event);
  };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        cardStyle,
        styles.interactive,
        pressed && !disabled && styles.pressed,
        pressed && !disabled && !reduceMotion && styles.pressedMotion,
        disabled && styles.disabled,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  interactive: {
    justifyContent: 'center',
    minHeight: Layout.cardMinHeight,
  },
  pressed: {
    opacity: 0.9,
  },
  pressedMotion: {
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
