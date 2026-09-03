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
import { Colors } from '@constants/colors';
import { Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import type { PatientProfile, PatientSettings } from '@db/schema.types';
import { getRegionName, t, type TranslationKey } from '@i18n/index';
import { clearActivePatientFlags, resolveActivePatient } from '@services/active-patient.service';
import { SecureStorageKeys, setSecureValue } from '@services/secure-storage.service';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  { descriptionKey: 'homeCareDescription', icon: 'favorite', titleKey: 'homeCareTitle' },
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
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<HomeData | null>(null);
  const [status, setStatus] = useState<HomeStatus>('loading');
  const [noticeTitle, setNoticeTitle] = useState<string | null>(null);

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
  }, [attempt, resetOnboarding, router]);

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
      <ScreenWrapper contentContainerStyle={styles.centered}>
        <ThemedText accessibilityRole="header" type="screenTitle">
          Smaran
        </ThemedText>
        {status === 'failed' ? (
          <View accessibilityRole="alert" style={styles.recovery}>
            <ThemedText>{t('en', 'homeLoadFailed')}</ThemedText>
            <SmaranButton
              accessibilityLabel={t('en', 'retry')}
              label={t('en', 'retry')}
              onPress={() => setAttempt((current) => current + 1)}
            />
            <SmaranButton
              accessibilityLabel={t('en', 'homeReturnSetup')}
              label={t('en', 'homeReturnSetup')}
              onPress={() => void returnToSetup()}
              variant="outline"
            />
          </View>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator
              accessibilityLabel={t('en', 'homeLoading')}
              color={colors.primary}
              size="large"
            />
            <ThemedText>{t('en', 'homeLoading')}</ThemedText>
          </View>
        )}
      </ScreenWrapper>
    );
  }

  const { profile, settings } = data;
  const language = settings.language;
  const regionName = getRegionName(language, settings.region);
  const textSize = getTextSizePreference(settings);
  const greeting = t(language, getGreetingKey(new Date().getHours()), {
    name: profile.preferredName,
  });
  const descriptions = homeActions.map(({ descriptionKey }) =>
    t(language, descriptionKey, { region: regionName })
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
              accessible={false}
              color={colors.onActionPrimary}
              name="spa"
              size={28}
            />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText textSize={textSize} type="cardHeading">
              Smaran
            </ThemedText>
            <View style={styles.regionRow}>
              <MaterialIcons accessible={false} color={colors.secondary} name="place" size={20} />
              <ThemedText textSize={textSize} type="secondary">
                {t(language, 'homeRegionContext', { region: regionName })}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.greeting}>
          <ThemedText accessibilityRole="header" textSize={textSize} type="screenTitle">
            {greeting}
          </ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'homeSupportingLine')}</ThemedText>
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
          <MaterialIcons accessible={false} color={colors.success} name="offline-pin" size={30} />
          <View style={styles.offlineCopy}>
            <ThemedText textSize={textSize} type="defaultSemiBold">
              {t(language, 'readyOffline')}
            </ThemedText>
            <ThemedText textSize={textSize} type="secondary">
              {t(language, 'homeOfflineDescription')}
            </ThemedText>
          </View>
        </View>

        <View style={styles.actions}>
          {homeActions.map((action, index) => {
            const title = t(language, action.titleKey);
            return (
              <View key={action.titleKey} style={styles.action}>
                <HomeActionCard
                  accessibilityHint={t(language, 'homeActionHint')}
                  description={descriptions[index]}
                  featured={action.featured}
                  highContrast={settings.highContrast}
                  icon={action.icon}
                  label={action.featured ? t(language, 'homeFocusLabel') : undefined}
                  onPress={() => setNoticeTitle(title)}
                  reducedMotion={settings.reducedMotion}
                  textSize={textSize}
                  title={title}
                />
                {noticeTitle === title ? (
                  <View
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    style={[
                      styles.notice,
                      { backgroundColor: colors.warningSurface, borderColor: colors.warning },
                    ]}>
                    <MaterialIcons
                      accessible={false}
                      color={colors.warning}
                      name="info-outline"
                      size={28}
                    />
                    <ThemedText style={styles.noticeText} textSize={textSize}>
                      {t(language, 'homeActionNotice', { title })}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            );
          })}
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
  regionRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.xs },
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
  notice: {
    alignItems: 'flex-start',
    borderRadius: Radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  noticeText: { flex: 1 },
});
