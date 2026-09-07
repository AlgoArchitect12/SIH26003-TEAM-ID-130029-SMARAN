import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { HomeActionCard } from '@components/patient/home-action-card';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { clearActivePatientFlags, resolveActivePatient } from '@services/active-patient.service';
import { SecureStorageKeys, setSecureValue } from '@services/secure-storage.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type HomeData = { profile: PatientProfile; settings: PatientSettings };
type HomeStatus = 'loading' | 'ready' | 'failed';

const homeActions: readonly {
  descriptionKey: TranslationKey;
  featured?: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  titleKey: TranslationKey;
}[] = [
  {
    descriptionKey: 'homeTrainDescription',
    featured: true,
    icon: 'psychology',
    titleKey: 'homeTrainTitle',
  },
  { descriptionKey: 'homeDayDescription', icon: 'event-note', titleKey: 'homeDayTitle' },
  {
    descriptionKey: 'homeMemoriesDescription',
    icon: 'photo-library',
    titleKey: 'homeMemoriesTitle',
  },
  { descriptionKey: 'homeRegionDescription', icon: 'landscape', titleKey: 'homeRegionTitle' },
  { descriptionKey: 'careIntro', icon: 'favorite', titleKey: 'homeCareTitle' },
];

function getGreetingKey(hour: number): TranslationKey {
  if (hour < 12) return 'homeGreetingMorning';
  if (hour < 17) return 'homeGreetingAfternoon';
  return 'homeGreetingEvening';
}

function getTextSizePreference(settings: PatientSettings): TextSizePreference {
  if (settings.textSize === 'standard') return 'normal';
  return settings.textSize === 'extra-large' ? 'extraLarge' : 'large';
}

export default function PatientHomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const loadingLanguage = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<HomeData | null>(null);
  const [status, setStatus] = useState<HomeStatus>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');

    resolveActivePatient()
      .then(async (resolution) => {
        if (resolution.status !== 'ready') {
          if (resolution.status === 'inconsistent') await clearActivePatientFlags();
          resetOnboarding();
          if (active) router.replace('/onboarding/role');
          return;
        }

        if (!resolution.completionConfirmed) {
          await setSecureValue(SecureStorageKeys.onboardingCompleted, 'true');
        }
        if (active) {
          setLanguage(resolution.settings.language);
        setAccessibility({
          highContrast: resolution.settings.highContrast,
          reducedMotion: resolution.settings.reducedMotion,
          textSize: resolution.settings.textSize,
          voiceGuidance: resolution.settings.voiceGuidance,
        });
          setData({ profile: resolution.profile, settings: resolution.settings });
          setStatus('ready');
        }
      })
      .catch((error: unknown) => {
        if (__DEV__) console.error('Patient home could not be prepared', error);
        if (active) setStatus('failed');
      });

    return () => {
      active = false;
    };
  }, [attempt, resetOnboarding, router, setAccessibility, setLanguage]);

  const returnToSetup = async () => {
    try {
      await clearActivePatientFlags();
    } catch (error) {
      if (__DEV__) console.error('Patient session flags could not be cleared', error);
    }
    resetOnboarding();
    router.replace('/onboarding/role');
  };

  if (status !== 'ready' || !data) {
    return (
      <ScreenWrapper contentContainerStyle={styles.centered} scroll>
        <ThemedText accessibilityRole="header" type="screenTitle">
          Smaran AI
        </ThemedText>
        {status === 'failed' ? (
          <View accessibilityRole="alert" style={styles.recovery}>
            <ThemedText>{t(loadingLanguage, 'homeLoadFailed')}</ThemedText>
            <SmaranButton
              accessibilityLabel={t(loadingLanguage, 'retry')}
              label={t(loadingLanguage, 'retry')}
              onPress={() => setAttempt((current) => current + 1)}
            />
            <SmaranButton
              accessibilityLabel={t(loadingLanguage, 'homeReturnSetup')}
              label={t(loadingLanguage, 'homeReturnSetup')}
              onPress={() => void returnToSetup()}
              variant="outline"
            />
          </View>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator
              accessibilityLabel={t(loadingLanguage, 'homeLoading')}
              color={colors.primary}
              size="large"
            />
            <ThemedText>{t(loadingLanguage, 'homeLoading')}</ThemedText>
          </View>
        )}
      </ScreenWrapper>
    );
  }

  const { profile, settings } = data;
  const language = settings.language;
  const textSize = getTextSizePreference(settings);
  const greeting = t(language, getGreetingKey(new Date().getHours()), {
    name: profile.preferredName,
  });
  const descriptions = homeActions.map(({ descriptionKey }) =>
    t(language, descriptionKey)
  );
  const speechText = [
    greeting,
    t(language, 'homeSupportingLine'),
    ...homeActions.map(
      ({ titleKey }, index) => `${t(language, titleKey)}. ${descriptions[index]}`
    ),
    `${t(language, 'readyOffline')}. ${t(language, 'homeOfflineDescription')}`,
  ].join(' ');

  return (
    <ScreenWrapper contentContainerStyle={styles.scrollContent} scroll>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.brandMark, { backgroundColor: colors.actionPrimary }]}>
            <MaterialIcons
              accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
              color={colors.onActionPrimary}
              name="spa"
              size={28}
            />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText textSize={textSize} type="cardHeading">
              Smaran AI
            </ThemedText>
            <ThemedText textSize={textSize} type="secondary">{t(language, 'appTagline')}</ThemedText>
          </View>
        </View>

        <View style={styles.greeting}>
          <ThemedText accessibilityRole="header" textSize={textSize} type="screenTitle">
            {greeting}
          </ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'homeSupportingLine')}</ThemedText>
        </View>

        <View style={styles.actions}>
          {homeActions.map((action, index) => {
            const title = t(language, action.titleKey);
            return (
              <View key={action.titleKey} style={styles.action}>
                <HomeActionCard
                  accessibilityHint={t(
                    language,
                    action.featured ? 'activitiesOpen' : action.titleKey === 'homeDayTitle' ? 'dayOpenHint' : action.titleKey === 'homeMemoriesTitle' ? 'memoryOpenHint' : action.titleKey === 'homeRegionTitle' ? 'regionalOpenHint' : 'careOpen'
                  )}
                  description={descriptions[index]}
                  featured={action.featured}
                  highContrast={settings.highContrast}
                  icon={action.icon}
                  onPress={() =>
                    action.featured
                      ? router.push('/patient/games')
                      : action.titleKey === 'homeDayTitle' ? router.push('/patient/my-day') : action.titleKey === 'homeMemoriesTitle' ? router.push('/patient/my-memories') : action.titleKey === 'homeRegionTitle' ? router.push('/patient/my-home') : router.push('/caregiver/home')
                  }
                  reducedMotion={settings.reducedMotion}
                  textSize={textSize}
                  title={title}
                />
              </View>
            );
          })}
        </View>
        {settings.voiceGuidance ? (
          <ReadScreenButton language={language} text={speechText} />
        ) : null}

        <View
          accessible
          accessibilityLabel={`${t(language, 'readyOffline')}. ${t(language, 'homeOfflineDescription')}`}
          style={[
            styles.offline,
            {
              backgroundColor: settings.highContrast ? colors.surface : colors.successSurface,
              borderColor: settings.highContrast ? colors.text : colors.success,
              borderWidth: settings.highContrast ? 3 : 1,
            },
          ]}>
          <MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={colors.success} name="offline-pin" size={30} />
          <View style={styles.offlineCopy}>
            <ThemedText textSize={textSize} type="defaultSemiBold">
              {t(language, 'readyOffline')}
            </ThemedText>
            <ThemedText textSize={textSize} type="secondary">
              {t(language, 'homeOfflineDescription')}
            </ThemedText>
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  content: {
    alignSelf: 'center',
    gap: Spacing.lg,
    maxWidth: 680,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    gap: Spacing.xl,
    justifyContent: 'center',
  },
  recovery: { gap: Spacing.md, maxWidth: 520, width: '100%' },
  loading: { alignItems: 'center', gap: Spacing.md },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  brandMark: {
    alignItems: 'center',
    borderRadius: Radius.button,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  headerCopy: { flex: 1 },
  greeting: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  offline: {
    alignItems: 'center',
    borderRadius: Radius.card,
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  offlineCopy: { flex: 1, gap: Spacing.xs },
  actions: { gap: Spacing.md },
  action: { gap: Spacing.sm },
});
