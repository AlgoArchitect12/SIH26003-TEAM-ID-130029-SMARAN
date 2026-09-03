import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Colors } from '@constants/colors';
import { Spacing } from '@constants/layout';
import { patientRepository } from '@db/repositories/patient.repository';
import {
  deleteSecureValue,
  getSecureValue,
  SecureStorageKeys,
  setSecureValue,
} from '@services/secure-storage.service';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type LaunchStatus = 'loading' | 'failed';

export default function IndexScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<LaunchStatus>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');

    const resolveLaunchRoute = async () => {
      const [completionFlag, activeProfileId] = await Promise.all([
        getSecureValue(SecureStorageKeys.onboardingCompleted),
        getSecureValue(SecureStorageKeys.activeProfileId),
      ]);

      if (activeProfileId) {
        const [profile, settings] = await Promise.all([
          patientRepository.getProfileById(activeProfileId),
          patientRepository.getSettings(activeProfileId),
        ]);

        if (profile && settings) {
          if (completionFlag !== 'true') {
            await setSecureValue(SecureStorageKeys.onboardingCompleted, 'true');
          }
          if (active) {
            router.replace('/onboarding/complete');
          }
          return;
        }

        await Promise.all([
          deleteSecureValue(SecureStorageKeys.activeProfileId),
          deleteSecureValue(SecureStorageKeys.onboardingCompleted),
        ]);
      } else if (completionFlag === 'true') {
        await deleteSecureValue(SecureStorageKeys.onboardingCompleted);
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
  }, [attempt, resetOnboarding, router]);

  return (
    <ScreenWrapper contentContainerStyle={styles.screen}>
      <View style={styles.brand}>
        <ThemedText accessibilityRole="header" style={styles.title} type="screenTitle">
          Smaran AI
        </ThemedText>
        <ThemedText style={styles.tagline}>Mindful Memory &amp; Daily Care</ThemedText>
        <ThemedText style={styles.subtitle} type="secondary">
          Thoughtfully crafted for you and your family
        </ThemedText>
      </View>
      {status === 'loading' ? (
        <ActivityIndicator
          accessibilityLabel="Preparing Smaran AI"
          color={Colors[colorScheme].primary}
          size="large"
        />
      ) : (
        <View accessibilityRole="alert" style={styles.recovery}>
          <ThemedText>Your saved information is safe. Please try preparing Smaran again.</ThemedText>
          <SmaranButton
            accessibilityLabel="Try preparing Smaran AI again"
            label="Try Again"
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
