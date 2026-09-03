import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Colors } from '@constants/colors';
import { Spacing } from '@constants/layout';
import { patientRepository } from '@db/repositories/patient.repository';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { getLanguageName, getRegionName, getTextSizeName, t } from '@i18n/index';
import {
  deleteSecureValue,
  getSecureValue,
  SecureStorageKeys,
} from '@services/secure-storage.service';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type CompleteData = {
  profile: PatientProfile;
  settings: PatientSettings;
};

function SummaryRow({ label }: { label: string }) {
  const colorScheme = useColorScheme() ?? 'light';
  return (
    <View style={styles.summaryRow}>
      <MaterialIcons color={Colors[colorScheme].success} name="check-circle" size={26} />
      <ThemedText>{label}</ThemedText>
    </View>
  );
}

export default function CompleteScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<CompleteData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    const load = async () => {
      const [activeProfileId, completionFlag] = await Promise.all([
        getSecureValue(SecureStorageKeys.activeProfileId),
        getSecureValue(SecureStorageKeys.onboardingCompleted),
      ]);

      if (!activeProfileId || completionFlag !== 'true') {
        resetOnboarding();
        if (active) {
          router.replace('/onboarding/role');
        }
        return;
      }

      const [profile, settings] = await Promise.all([
        patientRepository.getProfileById(activeProfileId),
        patientRepository.getSettings(activeProfileId),
      ]);

      if (!profile || !settings) {
        await Promise.all([
          deleteSecureValue(SecureStorageKeys.activeProfileId),
          deleteSecureValue(SecureStorageKeys.onboardingCompleted),
        ]);
        resetOnboarding();
        if (active) {
          router.replace('/onboarding/role');
        }
        return;
      }

      if (active) {
        setData({ profile, settings });
      }
    };

    load().catch((error: unknown) => {
      if (__DEV__) {
        console.error('Completed onboarding could not be loaded', error);
      }
      if (active) {
        setFailed(true);
      }
    });

    return () => {
      active = false;
    };
  }, [attempt, resetOnboarding, router]);

  if (!data) {
    return (
      <ScreenWrapper contentContainerStyle={styles.loadingScreen}>
        <ThemedText accessibilityRole="header" type="screenTitle">
          Smaran AI
        </ThemedText>
        {failed ? (
          <View accessibilityRole="alert" style={styles.loadingContent}>
            <ThemedText>{t('en', 'setupUnavailable')}</ThemedText>
            <SmaranButton
              accessibilityLabel={t('en', 'retry')}
              label={t('en', 'retry')}
              onPress={() => setAttempt((current) => current + 1)}
            />
          </View>
        ) : (
          <View style={styles.loadingContent}>
            <ActivityIndicator
              accessibilityLabel={t('en', 'loadingSetup')}
              color={Colors[colorScheme].primary}
              size="large"
            />
            <ThemedText>{t('en', 'loadingSetup')}</ThemedText>
          </View>
        )}
      </ScreenWrapper>
    );
  }

  const { profile, settings } = data;
  const title = t(settings.language, 'completeTitle', { name: profile.preferredName });
  const languageSummary = `${t(settings.language, 'languageLabel')}: ${getLanguageName(settings.language)}`;
  const regionSummary = `${t(settings.language, 'regionLabel')}: ${getRegionName(settings.language, settings.region)}`;
  const textSizeSummary = t(settings.language, 'textSizeSaved', {
    size: getTextSizeName(settings.language, settings.textSize),
  });

  return (
    <OnboardingScreen
      description={t(settings.language, 'completeIntro')}
      language={settings.language}
      speechText={`${title} ${t(settings.language, 'completeIntro')} ${languageSummary}. ${regionSummary}. ${textSizeSummary}. ${t(settings.language, 'readyOffline')}.`}
      title={title}>
      <SmaranCard style={styles.summary}>
        <SummaryRow label={languageSummary} />
        <SummaryRow label={regionSummary} />
        <SummaryRow label={t(settings.language, 'accessibilitySaved')} />
        <SummaryRow label={textSizeSummary} />
        <SummaryRow label={t(settings.language, 'readyOffline')} />
      </SmaranCard>
      <SmaranButton
        accessibilityLabel={t(settings.language, 'continue')}
        label={t(settings.language, 'continue')}
        onPress={() => router.replace('/patient/home')}
        size="large"
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    gap: Spacing.xl,
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: Spacing.lg,
    maxWidth: 520,
    width: '100%',
  },
  summary: {
    gap: Spacing.md,
  },
  summaryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
