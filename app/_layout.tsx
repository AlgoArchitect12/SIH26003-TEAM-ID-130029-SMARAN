import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { Colors } from '@constants/colors';

import { ErrorBoundary } from '@components/error-boundary';
import { ThemedText } from '@components/themed-text';
import { useThemeColors } from '@/hooks/use-theme-color';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { initializeDatabase } from '@db/client';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type BootstrapStatus = 'loading' | 'ready' | 'failed';

function DatabaseBootstrap() {
  const colors = useThemeColors();
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
    return <>
      <StatusBar style={colors.background === Colors.dark.background ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    </>;
  }

  return (
    <ScreenWrapper scroll contentContainerStyle={styles.container}>
      <StatusBar style={colors.background === Colors.dark.background ? 'light' : 'dark'} />
      <ThemedText type="screenTitle">Smaran AI</ThemedText>
      {status === 'failed' ? <ThemedText accessibilityRole="alert" style={styles.message}>{t(language, 'setupUnavailable')}</ThemedText>
        : <SmaranLoading label={t(language, 'loadingSetup')} />}
      {status === 'failed' ? (
        <SmaranButton
          accessibilityLabel={t(language, 'retry')}
          label={t(language, 'retry')}
          onPress={() => setAttempt((current) => current + 1)}
          style={styles.button}
        />
      ) : null}
    </ScreenWrapper>
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
    flexGrow: 1,
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
