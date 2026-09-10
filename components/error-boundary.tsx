import { router } from 'expo-router';
import { Component, useState, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Colors } from '@constants/colors';
import { Layout, Radius, Spacing } from '@constants/layout';
import { getScaledTypography, Typography } from '@constants/typography';
import { t } from '@i18n/index';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useTextSize } from '@/hooks/use-text-size';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type State = { hasError: boolean };

function ErrorFallback({ onReturn }: { onReturn: () => void }) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const textSize = useTextSize();
  const language = useOnboardingStore((state) => state.language) ?? 'en';

  return (
    <ScrollView accessibilityRole="alert" style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, getScaledTypography('cardHeading', textSize), { color: colors.text }]}>{t(language, 'errorSafeTitle')}</Text>
      <Text style={[styles.message, getScaledTypography('body', textSize), { color: colors.text }]}>{t(language, 'errorReturnMessage')}</Text>
      <Pressable
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityHint={t(language, 'errorReturnMessage')}
        accessibilityLabel={t(language, 'returnHome')}
        accessibilityRole="button"
        onPress={onReturn}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.actionPrimary }, focused && { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: 3, outlineOffset: 3 }, pressed && styles.buttonPressed]}>
        <Text style={[styles.buttonText, getScaledTypography('action', textSize), { color: colors.onActionPrimary }]}>{t(language, 'returnHome')}</Text>
      </Pressable>
    </ScrollView>
  );
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    if (__DEV__) console.error('Unhandled application error');
  }

  private returnHome = () => {
    this.setState({ hasError: false }, () => router.replace('/'));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return <ErrorFallback onReturn={this.returnHome} />;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  title: {
    ...Typography.cardHeading,
    color: Colors.light.text,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: Colors.light.actionPrimary,
    borderRadius: Radius.button,
    justifyContent: 'center',
    marginTop: Spacing.xl,
    minHeight: Layout.minTouchTarget,
    maxWidth: '100%',
    minWidth: 200,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...Typography.action,
    textAlign: 'center',
    color: Colors.light.onActionPrimary,
  },
});
