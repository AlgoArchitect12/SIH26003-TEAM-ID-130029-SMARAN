import { router } from 'expo-router';
import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#F9F8F5',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#1C2526',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#405052',
    fontSize: 18,
    lineHeight: 26,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0B4F56',
    borderRadius: 28,
    justifyContent: 'center',
    marginTop: 32,
    minHeight: 56,
    minWidth: 200,
    paddingHorizontal: 24,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
});
