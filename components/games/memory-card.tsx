import { MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@constants/colors';
import { Radius } from '@constants/layout';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHaptics } from '@/hooks/use-haptics';

import type { MemorySymbol } from '@/src/games/memory-match/assets';
import type { MemoryCardState } from '@/src/games/memory-match/types';

type MemoryCardProps = {
  accessibilityLabel: string;
  disabled: boolean;
  highContrast: boolean;
  hinted: boolean;
  onPress: () => void;
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
  reducedMotion,
  size,
  state,
  symbol,
}: MemoryCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const visible = state !== 'hidden' || hinted;
  const progress = useSharedValue(visible ? 1 : 0);
  const triggerHaptic = useHaptics(!disabled);

  useEffect(() => {
    progress.value = reducedMotion ? Number(visible) : withTiming(Number(visible), { duration: 320 });
  }, [progress, reducedMotion, visible]);

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
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: state === 'revealed' }}
      disabled={disabled}
      onPress={() => {
        void triggerHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pressable,
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
        <MaterialIcons
          accessible={false}
          color={colors.onActionPrimary}
          name="help-outline"
          size={Math.min(40, size * 0.44)}
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
        <MaterialIcons
          accessible={false}
          color={colors.primary}
          name={symbol.icon}
          size={Math.min(44, size * 0.5)}
        />
        {state === 'matched' ? (
          <MaterialIcons
            accessible={false}
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
