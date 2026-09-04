import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ErrorBoundary } from '@components/error-boundary';
import { ThemedText } from '@components/themed-text';
import { ThemedView } from '@components/themed-view';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { initializeDatabase } from '@db/client';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type BootstrapStatus = 'loading' | 'ready' | 'failed';

function DatabaseBootstrap() {
  const language = useOnboardingStore((state) => state.language) ?? 'en';
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<BootstrapStatus>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');

    initializeDatabase()
      .then(() => {
        if (active) {
          setStatus('ready');
        }
      })
      .catch((error: unknown) => {
        if (__DEV__) {
          console.error('Database initialization failed', error);
        }
        if (active) {
          setStatus('failed');
        }
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  if (status === 'ready') {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <ThemedView accessibilityRole={status === 'failed' ? 'alert' : undefined} style={styles.container}>
      <ThemedText type="screenTitle">Smaran AI</ThemedText>
      <ThemedText style={styles.message}>
        {status === 'failed'
          ? t(language, 'setupUnavailable')
          : t(language, 'loadingSetup')}
      </ThemedText>
      {status === 'failed' ? (
        <SmaranButton
          accessibilityLabel={t(language, 'retry')}
          label={t(language, 'retry')}
          onPress={() => setAttempt((current) => current + 1)}
          style={styles.button}
        />
      ) : null}
    </ThemedView>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <DatabaseBootstrap />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  message: {
    marginTop: Spacing.sm,
    maxWidth: 480,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.xl,
  },
});
