import { SmaranLoading } from '@components/ui/smaran-loading';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { t } from '@i18n/index';
import { clearActivePatientFlags, resolveActivePatient } from '@services/active-patient.service';
import { SecureStorageKeys, setSecureValue } from '@services/secure-storage.service';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type LaunchStatus = 'loading' | 'failed';

export default function IndexScreen() {
  const router = useRouter();
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const language = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<LaunchStatus>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');

    const resolveLaunchRoute = async () => {
      const resolution = await resolveActivePatient();

      if (resolution.status === 'ready') {
        setLanguage(resolution.settings.language);
        setAccessibility({
          highContrast: resolution.settings.highContrast,
          reducedMotion: resolution.settings.reducedMotion,
          textSize: resolution.settings.textSize,
          voiceGuidance: resolution.settings.voiceGuidance,
        });
        if (!resolution.completionConfirmed) {
          await setSecureValue(SecureStorageKeys.onboardingCompleted, 'true');
        }
        if (active) router.replace('/patient/home');
        return;
      }

      if (resolution.status === 'inconsistent') {
        await clearActivePatientFlags();
      }

      resetOnboarding();
      if (active) {
        router.replace('/onboarding/role');
      }
    };

    resolveLaunchRoute().catch((error: unknown) => {
      if (__DEV__) {
        console.error('Onboarding route resolution failed', error);
      }
      if (active) {
        setStatus('failed');
      }
    });

    return () => {
      active = false;
    };
  }, [attempt, resetOnboarding, router, setAccessibility, setLanguage]);

  return (
    <ScreenWrapper contentContainerStyle={styles.screen} scroll>
      <View style={styles.brand}>
        <ThemedText accessibilityRole="header" style={styles.title} type="screenTitle">
          Smaran AI
        </ThemedText>
        <ThemedText style={styles.tagline}>{t(language, 'appTagline')}</ThemedText>
        <ThemedText style={styles.subtitle} type="secondary">
          {t(language, 'appSubtitle')}
        </ThemedText>
      </View>
      {status === 'loading' ? (
        <SmaranLoading label={t(language, 'loadingSetup')} />
      ) : (
        <View accessibilityRole="alert" style={styles.recovery}>
          <ThemedText>{t(language, 'setupUnavailable')}</ThemedText>
          <SmaranButton
            accessibilityLabel={t(language, 'retry')}
            label={t(language, 'retry')}
            onPress={() => setAttempt((current) => current + 1)}
          />
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    maxWidth: 520,
  },
  title: {
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  recovery: {
    gap: Spacing.lg,
    maxWidth: 520,
    width: '100%',
  },
});
