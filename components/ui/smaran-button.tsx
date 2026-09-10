import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityState,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Layout, Radius, Spacing } from '@constants/layout';
import { getScaledTypography, Typography } from '@constants/typography';
import { useHaptics } from '@/hooks/use-haptics';
import { type ReducedMotionOverride, useReducedMotion } from '@/hooks/use-reduced-motion';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useTextSize } from '@/hooks/use-text-size';

export type SmaranButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline';
export type SmaranButtonSize = 'normal' | 'large';

export type SmaranButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  hapticsEnabled?: boolean;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
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
  accessibilityState,
  disabled = false,
  hapticsEnabled = true,
  icon,
  label,
  loading = false,
  onPress,
  reducedMotionOverride = null,
  size = 'normal',
  style,
  testID,
  textStyle,
  variant = 'primary',
}: SmaranButtonProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const textSize = useTextSize();
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
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, busy: loading, disabled }}
      aria-busy={loading} aria-disabled={disabled}
      disabled={disabled}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        focused && { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 3, outlineOffset: 3 },
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
        {loading ? (reduceMotion ? <MaterialIcons name="hourglass-empty" size={24} color={disabled ? colors.onDisabled : selectedVariant.color} accessible={false} aria-hidden /> : <ActivityIndicator color={disabled ? colors.onDisabled : selectedVariant.color} />) : icon}
        <Text
          style={[
            styles.label,
            getScaledTypography('action', textSize),
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
    maxWidth: '100%',
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
    minWidth: 0,
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
