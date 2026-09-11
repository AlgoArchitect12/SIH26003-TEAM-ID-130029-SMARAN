import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@constants/layout';
import { useHaptics } from '@/hooks/use-haptics';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { ThemedText } from '@components/themed-text';

import type { MemorySymbol } from '@/src/games/memory-match/assets';
import type { MemoryCardState } from '@/src/games/memory-match/types';

type MemoryCardProps = {
  accessibilityLabel: string;
  disabled: boolean;
  highContrast: boolean;
  hinted: boolean;
  onPress: () => void;
  positionLabel: string;
  reducedMotion: boolean;
  size: number;
  state: MemoryCardState;
  symbol: MemorySymbol;
};

export function MemoryCard({
  accessibilityLabel,
  disabled,
  highContrast,
  hinted,
  onPress,
  positionLabel,
  reducedMotion,
  size,
  state,
  symbol,
}: MemoryCardProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReducedMotion(reducedMotion ? true : null);
  const visible = state !== 'hidden' || hinted;
  const progress = useSharedValue(visible ? 1 : 0);
  const triggerHaptic = useHaptics(!disabled);

  useEffect(() => {
    progress.value = reduceMotion ? Number(visible) : withTiming(Number(visible), { duration: 220 });
  }, [progress, reduceMotion, visible]);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.49, 0.5], [1, 0]),
    transform: [{ perspective: 800 }, { rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.49, 0.5], [0, 1]),
    transform: [{ perspective: 800 }, { rotateY: `${interpolate(progress.value, [0, 1], [180, 360])}deg` }],
  }));

  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: visible }}
      disabled={disabled}
      onPress={() => {
        void triggerHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pressable,
        focused && { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 3, outlineOffset: 3 },
        { height: size, opacity: pressed ? 0.88 : 1, width: size },
      ]}>
      <Animated.View
        style={[
          styles.face,
          {
            backgroundColor: colors.actionPrimary,
            borderColor: highContrast ? colors.text : colors.primary,
            borderWidth: highContrast ? 3 : 2,
          },
          frontStyle,
        ]}>
        <ThemedText accessible={false} type="secondary" style={{ color: colors.onActionPrimary }}>{positionLabel}</ThemedText>
        <MaterialIcons
          accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          color={colors.onActionPrimary}
          name="help-outline"
          size={Math.min(52, size * 0.34)}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.face,
          {
            backgroundColor: state === 'matched' ? colors.successSurface : colors.surface,
            borderColor: highContrast || hinted ? colors.text : state === 'matched' ? colors.success : colors.accent,
            borderStyle: hinted ? 'dashed' : 'solid',
            borderWidth: highContrast || hinted ? 3 : 2,
          },
          backStyle,
        ]}>
        <ThemedText accessible={false} type="secondary">{positionLabel}</ThemedText>
        <MaterialIcons
          accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          color={colors.primary}
          name={symbol.icon}
          size={Math.min(64, size * 0.4)}
        />
        {state === 'matched' ? (
          <MaterialIcons
            accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            color={colors.success}
            name="check-circle"
            size={22}
            style={styles.check}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { position: 'relative' },
  face: {
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    borderRadius: Radius.card,
    height: '100%',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  check: { position: 'absolute', right: 5, top: 5 },
});
