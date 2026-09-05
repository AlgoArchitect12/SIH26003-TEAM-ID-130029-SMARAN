import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Layout, Spacing } from '@constants/layout';
import { useThemeColors } from '@/hooks/use-theme-color';

export type ScreenWrapperProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  header?: ReactNode;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function ScreenWrapper({
  children,
  contentContainerStyle,
  header,
  keyboardAvoiding = true,
  keyboardVerticalOffset = 0,
  scroll = false,
  style,
}: ScreenWrapperProps) {
  const backgroundColor = useThemeColors().background;

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={[styles.safeArea, { backgroundColor }, style]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={keyboardAvoiding}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.fill}>
        {header ? <View style={styles.header}>{header}</View> : null}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentContainerStyle]}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill, contentContainerStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  header: {
    justifyContent: 'center',
    minHeight: Layout.minTouchTarget,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    padding: Spacing.lg,
  },
});
