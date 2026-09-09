import { PatientNavigation } from '@components/patient/patient-navigation';
import { loadAppearance } from '@/src/stores/appearance.store';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { SmaranBrand } from '@components/ui/smaran-brand';

import { ErrorBoundary } from '@components/error-boundary';
import { ThemedText } from '@components/themed-text';
import { useAppearance, useThemeColors } from '@/hooks/use-theme-color';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { initializeDatabase } from '@db/client';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type BootstrapStatus = 'loading' | 'ready' | 'failed';

function DatabaseBootstrap() {
  const colors = useThemeColors();
  const { dark } = useAppearance();
  const language = useOnboardingStore((state) => state.language) ?? 'en';
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<BootstrapStatus>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');

    Promise.all([initializeDatabase(), loadAppearance()])
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
    return <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }} /></View>
      <PatientNavigation />
    </View>;
  }

  return (
    <ScreenWrapper scroll contentContainerStyle={styles.container}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <SmaranBrand />
      <ThemedText style={styles.message}>{t(language, 'appTagline')}</ThemedText>
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
