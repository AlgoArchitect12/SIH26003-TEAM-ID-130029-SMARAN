import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { Colors } from '@constants/colors';
import type { EncouragementTone } from '@constants/encouragement-messages';
import { Radius, Spacing } from '@constants/layout';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type ReducedMotionOverride, useReducedMotion } from '@/hooks/use-reduced-motion';

export type EncouragementBannerProps = {
  message: string;
  onAnnounce?: (message: string) => void;
  reducedMotionOverride?: ReducedMotionOverride;
  style?: StyleProp<ViewStyle>;
  tone: EncouragementTone;
};

export function EncouragementBanner({
  message,
  onAnnounce,
  reducedMotionOverride = null,
  style,
  tone,
}: EncouragementBannerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion(reducedMotionOverride);
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 12)).current;

  useEffect(() => {
    onAnnounce?.(message);

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(12);
    const animation = Animated.parallel([
      Animated.timing(opacity, { duration: 240, toValue: 1, useNativeDriver: true }),
      Animated.timing(translateY, { duration: 240, toValue: 0, useNativeDriver: true }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [message, onAnnounce, opacity, reduceMotion, translateY]);

  const isSuccess = tone === 'success';

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: isSuccess ? colors.successSurface : colors.warningSurface,
          borderColor: isSuccess ? colors.success : colors.warning,
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}>
      <ThemedText type="body">{message}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Radius.card,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
