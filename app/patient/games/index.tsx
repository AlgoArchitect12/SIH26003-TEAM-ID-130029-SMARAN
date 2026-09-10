import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { HomeActionCard } from '@components/patient/home-action-card';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { useTextSize } from '@/hooks/use-text-size';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { PageLayout } from '@constants/layout';
import { CognitiveActivityTypes, type CognitiveActivityType } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { activityTitleKeys } from '@/src/games/presentation';

const activities = {
  memory_match: { subtitle: 'memorySubtitle', route: '/patient/games/memory-match', icon: 'grid-view' },
  pattern_recognition: { subtitle: 'patternSubtitle', route: '/patient/games/pattern-recognition', icon: 'category' },
  routine_recall: { subtitle: 'routineSubtitle', route: '/patient/games/routine-recall', icon: 'format-list-numbered' },
} as const satisfies Record<CognitiveActivityType, { subtitle: TranslationKey; route: string; icon: string }>;

export default function ActivitiesScreen() {
  const router = useRouter();
  const textSize = useTextSize();
  const accessibility = useOnboardingStore(state => state.accessibility);
  const language = useOnboardingStore(state => state.language) ?? 'en';
  const voice = useOnboardingStore(state => state.accessibility.voiceGuidance);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const current = capturePatientRequest();
    setStatus('loading');
    void resolveActivePatient().then(resolution => {
      if (!active || !current()) return;
      if (resolution.status !== 'ready') { router.replace('/onboarding/role'); return; }
      const store = useOnboardingStore.getState(), settings = resolution.settings;
      store.setLanguage(settings.language);
      store.setAccessibilityPreferences({ textSize: settings.textSize, highContrast: settings.highContrast,
        reducedMotion: settings.reducedMotion, voiceGuidance: settings.voiceGuidance });
      setStatus('ready');
    }).catch(() => { if (active && current()) setStatus('failed'); });
    return () => { active = false; };
  }, [attempt, router]);
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'backHome')} accessibilityLabel={t(language, 'backHome')} variant="outline" onPress={() => router.dismissTo('/patient/home')} />
    <View style={PageLayout.heading}>
      <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'homeTrainTitle')}</ThemedText>
      <ThemedText type="secondary">{t(language, 'activitiesChoose')}</ThemedText>
    </View>
    {status === 'loading' && <SmaranLoading label={t(language, 'gameLoading')} />}
    {status === 'failed' && <>
      <ThemedText accessibilityRole="alert">{t(language, 'activityPrepareFailed')}</ThemedText>
      <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => setAttempt(value => value + 1)} />
    </>}
    {status === 'ready' && <>
      {CognitiveActivityTypes.map(game => <HomeActionCard key={game}
        title={t(language, activityTitleKeys[game])} description={t(language, activities[game].subtitle)}
        accessibilityHint={t(language, 'gameStart')} icon={activities[game].icon}
        highContrast={accessibility.highContrast} reducedMotion={accessibility.reducedMotion} textSize={textSize}
        onPress={() => router.push(activities[game].route)} />)}
      {voice && <ReadScreenButton language={language} text={[t(language, 'activitiesChoose'),
        ...CognitiveActivityTypes.map(game => t(language, activityTitleKeys[game]) + '. ' + t(language, activities[game].subtitle))].join(' ')} />}
    </>}
  </View></ScreenWrapper>;
}
const styles = StyleSheet.create({
  content: PageLayout.content,
});
