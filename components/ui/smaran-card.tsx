import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Elevation, Layout, Radius, Spacing } from '@constants/layout';
import { useHaptics } from '@/hooks/use-haptics';
import { type ReducedMotionOverride, useReducedMotion } from '@/hooks/use-reduced-motion';
import { useAppearance, useThemeColors } from '@/hooks/use-theme-color';

type BaseCardProps = {
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  checked?: boolean;
  disabled?: boolean;
  hapticsEnabled?: boolean;
  padding?: number;
  reducedMotionOverride?: ReducedMotionOverride;
  selected?: boolean;
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
  accessibilityRole = 'button',
  checked,
  children,
  disabled = false,
  hapticsEnabled = true,
  onPress,
  padding = Spacing.lg,
  reducedMotionOverride = null,
  selected = false,
  style,
  testID,
}: SmaranCardProps) {
  const colors = useThemeColors();
  const { highContrast } = useAppearance();
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReducedMotion(reducedMotionOverride);
  const triggerHaptic = useHaptics(hapticsEnabled && !disabled);
  const cardStyle = [
    styles.card,
    onPress && !highContrast && Elevation.card,
    {
      backgroundColor: selected ? colors.surfaceSelected : colors.surfaceRaised,
      borderColor: selected ? colors.primary : colors.border,
      borderWidth: selected || highContrast ? 3 : 1.5,
      padding,
    },
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
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked, disabled, selected: checked === undefined ? selected : undefined }}
      aria-checked={checked} aria-disabled={disabled} aria-selected={checked === undefined ? selected : undefined}
      disabled={disabled}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        cardStyle,
        focused && { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 3, outlineOffset: 3 },
        styles.interactive,
        pressed && !disabled && styles.pressed,
        pressed && !disabled && !reduceMotion && styles.pressedMotion,
        disabled && { backgroundColor: colors.disabled, borderColor: selected ? colors.primary : colors.border, borderStyle: 'dashed' },
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
    transform: [{ translateY: 2 }],
  },
});
