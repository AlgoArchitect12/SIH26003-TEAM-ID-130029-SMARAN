import { router } from 'expo-router';
import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@constants/colors';
import { Layout, Radius, Spacing } from '@constants/layout';
import { Typography } from '@constants/typography';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type State = { hasError: boolean };

function ErrorFallback({ onReturn }: { onReturn: () => void }) {
  const language = useOnboardingStore((state) => state.language) ?? 'en';

  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.title}>{t(language, 'errorSafeTitle')}</Text>
      <Text style={styles.message}>{t(language, 'errorReturnMessage')}</Text>
      <Pressable
        accessibilityHint={t(language, 'errorReturnMessage')}
        accessibilityLabel={t(language, 'returnHome')}
        accessibilityRole="button"
        onPress={onReturn}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>{t(language, 'returnHome')}</Text>
      </Pressable>
    </View>
  );
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info.componentStack);
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
    backgroundColor: Colors.light.background,
    flex: 1,
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
    minWidth: 200,
    paddingHorizontal: Spacing.lg,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...Typography.action,
    color: Colors.light.onActionPrimary,
  },
});
