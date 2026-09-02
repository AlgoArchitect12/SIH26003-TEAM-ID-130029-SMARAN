import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Colors } from '@constants/colors';
import { Layout, Radius, Spacing } from '@constants/layout';
import { Typography } from '@constants/typography';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHaptics } from '@/hooks/use-haptics';
import { type ReducedMotionOverride, useReducedMotion } from '@/hooks/use-reduced-motion';

export type SmaranButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline';
export type SmaranButtonSize = 'normal' | 'large';

export type SmaranButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  hapticsEnabled?: boolean;
  icon?: ReactNode;
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  reducedMotionOverride?: ReducedMotionOverride;
  size?: SmaranButtonSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  textStyle?: StyleProp<TextStyle>;
  variant?: SmaranButtonVariant;
};

export function SmaranButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  hapticsEnabled = true,
  icon,
  label,
  onPress,
  reducedMotionOverride = null,
  size = 'normal',
  style,
  testID,
  textStyle,
  variant = 'primary',
}: SmaranButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion(reducedMotionOverride);
  const triggerHaptic = useHaptics(hapticsEnabled && !disabled);
  const variants = {
    primary: {
      backgroundColor: colors.actionPrimary,
      borderColor: colors.actionPrimary,
      color: colors.onActionPrimary,
    },
    secondary: {
      backgroundColor: colors.actionSecondary,
      borderColor: colors.actionSecondary,
      color: colors.onActionSecondary,
    },
    accent: {
      backgroundColor: colors.actionAccent,
      borderColor: colors.accent,
      color: colors.onActionAccent,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.primary,
      color: colors.text,
    },
  } as const;
  const selectedVariant = variants[variant];

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
        styles.button,
        {
          backgroundColor: disabled ? colors.disabled : selectedVariant.backgroundColor,
          borderColor: disabled ? colors.disabled : selectedVariant.borderColor,
          minHeight: size === 'large' ? Layout.largeButtonHeight : Layout.minTouchTarget,
        },
        pressed && !disabled && styles.pressed,
        pressed && !disabled && !reduceMotion && styles.pressedMotion,
        style,
      ]}>
      <View style={styles.content}>
        {icon}
        <Text
          style={[
            styles.label,
            { color: disabled ? colors.onDisabled : selectedVariant.color },
            textStyle,
          ]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: Radius.button,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  label: {
    ...Typography.action,
    flexShrink: 1,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  pressedMotion: {
    transform: [{ scale: 0.98 }],
  },
});
