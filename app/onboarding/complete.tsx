import { SmaranLoading } from '@components/ui/smaran-loading';
import { SmaranBrand } from '@components/ui/smaran-brand';
import { getDateOfBirth } from '@services/profile-details.service';
import { displayDateOfBirth, ageFromDateOfBirth } from '@/src/utils/date-of-birth';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Spacing } from '@constants/layout';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { getLanguageName, getRegionName, getTextSizeName, t } from '@i18n/index';
import { PatientSelectionRequiredError, resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type CompleteData = {
  dateOfBirth: string | null;
  profile: PatientProfile;
  settings: PatientSettings;
};

function SummaryRow({ label }: { label: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.summaryRow}>
      <MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={colors.success} name="check-circle" size={26} />
      <ThemedText>{label}</ThemedText>
    </View>
  );
}

export default function CompleteScreen() {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const loadingLanguage = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<CompleteData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    const load = async () => {
      const resolution = await resolveActivePatient();
      if (resolution.status === 'fresh') {
        if (active) router.replace('/');
        return;
      }
      if (!resolution.completionConfirmed) {
        if (active) router.replace('/');
        return;
      }
      const { profile, settings } = resolution;
      const dateOfBirth = await getDateOfBirth(profile.id);
      if (active) {
        resetOnboarding();
        setLanguage(settings.language);
        setAccessibility({
          highContrast: settings.highContrast,
          reducedMotion: settings.reducedMotion,
          textSize: settings.textSize,
          voiceGuidance: settings.voiceGuidance,
        });
        setData({ profile, settings, dateOfBirth });
      }
    };

    load().catch(error => {
      if (active && error instanceof PatientSelectionRequiredError) { router.replace('/profiles'); return; }
      if (__DEV__) {
        console.error('Completed onboarding could not be loaded');
      }
      if (active) {
        setFailed(true);
      }
    });

    return () => {
      active = false;
    };
  }, [attempt, resetOnboarding, router, setAccessibility, setLanguage]);

  if (!data) {
    return (
      <ScreenWrapper header={null} contentContainerStyle={styles.loadingScreen} scroll>
        <SmaranBrand />
        {failed ? (
          <View accessibilityRole="alert" style={styles.loadingContent}>
            <ThemedText>{t(loadingLanguage, 'setupUnavailable')}</ThemedText>
            <SmaranButton
              accessibilityLabel={t(loadingLanguage, 'retry')}
              label={t(loadingLanguage, 'retry')}
              onPress={() => setAttempt((current) => current + 1)}
            />
          </View>
        ) : (
          <View style={styles.loadingContent}>
            <SmaranLoading label={t(loadingLanguage, 'loadingSetup')} />
          </View>
        )}
      </ScreenWrapper>
    );
  }

  const { profile, settings } = data;
  const title = t(settings.language, 'completeTitle', { name: profile.preferredName });
  const languageSummary = `${t(settings.language, 'languageLabel')}: ${getLanguageName(settings.language)}`;
  const regionSummary = `${t(settings.language, 'regionLabel')}: ${getRegionName(settings.language, settings.region)}`;
  const dobSummary = data.dateOfBirth ? `${t(settings.language, 'dob')}: ${displayDateOfBirth(data.dateOfBirth)}. ${t(settings.language, 'ageYears', { age: String(ageFromDateOfBirth(data.dateOfBirth)) })}` : t(settings.language, 'dobMissing');
  const textSizeSummary = t(settings.language, 'textSizeSaved', {
    size: getTextSizeName(settings.language, settings.textSize),
  });

  return (
    <OnboardingScreen
      description={t(settings.language, 'completeIntro')}
      language={settings.language}
      showReadAloud={settings.voiceGuidance}
      speechText={`${title} ${t(settings.language, 'completeIntro')} ${dobSummary}. ${languageSummary}. ${regionSummary}. ${textSizeSummary}. ${t(settings.language, 'readyOffline')}.`}
      title={title}>
      <SmaranCard style={styles.summary}>
        <SummaryRow label={data.dateOfBirth ? `${t(settings.language, 'dob')}: ${displayDateOfBirth(data.dateOfBirth)}` : t(settings.language, 'dobMissing')} />
        {data.dateOfBirth && <SummaryRow label={t(settings.language, 'ageYears', { age: String(ageFromDateOfBirth(data.dateOfBirth)) })} />}
        <SummaryRow label={languageSummary} />
        <SummaryRow label={regionSummary} />
        <SummaryRow label={t(settings.language, 'accessibilitySaved')} />
        <SummaryRow label={textSizeSummary} />
        <SummaryRow label={t(settings.language, 'readyOffline')} />
      </SmaranCard>
      <SmaranButton
        accessibilityLabel={t(settings.language, 'continue')}
        label={t(settings.language, 'continue')}
        onPress={() => router.replace(view === 'caregiver' ? '/caregiver/home' : '/patient/home')}
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
