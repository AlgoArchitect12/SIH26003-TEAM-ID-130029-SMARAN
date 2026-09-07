import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { Spacing } from '@constants/layout';
import { CognitiveActivityTypes, type CognitiveActivityType } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { activityTitleKeys } from '@/src/games/presentation';

const activities = {
  memory_match: { subtitle: 'memorySubtitle', route: '/patient/games/memory-match' },
  pattern_recognition: { subtitle: 'patternSubtitle', route: '/patient/games/pattern-recognition' },
  routine_recall: { subtitle: 'routineSubtitle', route: '/patient/games/routine-recall' },
} as const satisfies Record<CognitiveActivityType, { subtitle: TranslationKey; route: string }>;

export default function ActivitiesScreen() {
  const router = useRouter();
  const language = useOnboardingStore(state => state.language) ?? 'en';
  const voice = useOnboardingStore(state => state.accessibility.voiceGuidance);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    void resolveActivePatient().then(resolution => {
      if (!active) return;
      if (resolution.status !== 'ready') { router.replace('/onboarding/role'); return; }
      const store = useOnboardingStore.getState(), settings = resolution.settings;
      store.setLanguage(settings.language);
      store.setAccessibilityPreferences({ textSize: settings.textSize, highContrast: settings.highContrast,
        reducedMotion: settings.reducedMotion, voiceGuidance: settings.voiceGuidance });
      setStatus('ready');
    }).catch(() => { if (active) setStatus('failed'); });
    return () => { active = false; };
  }, [attempt, router]);
  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton label={t(language, 'backHome')} accessibilityLabel={t(language, 'backHome')} variant="outline" onPress={() => router.replace('/patient/home')} />
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language, 'homeTrainTitle')}</ThemedText>
    <ThemedText>{t(language, 'activitiesChoose')}</ThemedText>
    {status === 'loading' && <ThemedText>{t(language, 'gameLoading')}</ThemedText>}
    {status === 'failed' && <>
      <ThemedText accessibilityRole="alert">{t(language, 'activityPrepareFailed')}</ThemedText>
      <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={() => setAttempt(value => value + 1)} />
    </>}
    {status === 'ready' && <>
      {CognitiveActivityTypes.map(game => <SmaranCard key={game} style={styles.card}
        accessibilityLabel={t(language, activityTitleKeys[game]) + '. ' + t(language, activities[game].subtitle)}
        onPress={() => router.push(activities[game].route)}>
        <ThemedText type="cardHeading">{t(language, activityTitleKeys[game])}</ThemedText>
        <ThemedText>{t(language, activities[game].subtitle)}</ThemedText>
      </SmaranCard>)}
      {voice && <ReadScreenButton language={language} text={[t(language, 'activitiesChoose'),
        ...CognitiveActivityTypes.map(game => t(language, activityTitleKeys[game]) + '. ' + t(language, activities[game].subtitle))].join(' ')} />}
    </>}
  </View></ScreenWrapper>;
}
const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 680, gap: Spacing.lg },
  card: { gap: Spacing.sm, minHeight: 120 },
});
