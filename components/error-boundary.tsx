import { router } from 'expo-router';
import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@constants/colors';
import { Layout, Radius, Spacing } from '@constants/layout';
import { Typography } from '@constants/typography';

type State = { hasError: boolean };

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

    return (
      <View accessibilityRole="alert" style={styles.container}>
        <Text style={styles.title}>Everything is safe.</Text>
        <Text style={styles.message}>Let&apos;s return to your home screen.</Text>
        <Pressable
          accessibilityHint="Returns to the Smaran AI start screen"
          accessibilityRole="button"
          onPress={this.returnHome}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Return Home</Text>
        </Pressable>
      </View>
    );
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
