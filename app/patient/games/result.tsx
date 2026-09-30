import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { useGameTransition } from '@/hooks/use-game-transition';
import type { Href } from 'expo-router';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation, usePreventRemove } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { saveCognitiveResult } from '@services/cognitive.service';
import { activitySummary, activityTitleKeys } from '@/src/games/presentation';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { PageIntro } from '@components/ui/page-intro';
import { PageLayout, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import type { ActivityFeedbackLabel, PatientSettings } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useCognitiveSessionStore } from '@/src/stores/cognitive-session.store';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

type ResultStatus = 'loading' | 'ready' | 'failed';

const feedbackOptions: readonly { label: ActivityFeedbackLabel; key: TranslationKey }[] = [
  { key: 'feedbackEasy', label: 'easy' },
  { key: 'feedbackComfortable', label: 'comfortable' },
  { key: 'feedbackChallenging', label: 'challenging' },
];

function textSizeFor(settings: PatientSettings): TextSizePreference {
  if (settings.textSize === 'standard') return 'normal';
  return settings.textSize === 'extra-large' ? 'extraLarge' : 'large';
}

function recommendationKey(direction: 'gentler' | 'hold' | 'challenge'): TranslationKey {
  if (direction === 'gentler') return 'recommendationGentler';
  return direction === 'challenge' ? 'recommendationChallenge' : 'recommendationHold';
}

export default function CognitiveResultScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const colors = useThemeColors();
  const pending = useCognitiveSessionStore((state) => state.pending);
  const saved = useCognitiveSessionStore((state) => state.saved);
  const setSaved = useCognitiveSessionStore((state) => state.setSaved);
  const clear = useCognitiveSessionStore((state) => state.clear);
  const loadingLanguage = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);
  const [settings, setSettings] = useState<PatientSettings | null>(null);
  const [preferredName, setPreferredName] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [status, setStatus] = useState<ResultStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const submissionLocked = useRef(false);
  const live = useRef(true);
  const removeAfterSave = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const automaticSave = useRef<() => void>(() => {});
  useGameTransition(status === 'ready' && pending && !saved && !saving && !saveFailed ? 6000 : null, () => automaticSave.current(), paused);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    const current = capturePatientRequest();
    setStatus('loading');
    if (!pending && !saved) {
      router.dismissTo('/patient/games');
      return;
    }
    resolveActivePatient()
      .then((resolution) => {
        if (!active || !current()) return;
        if (resolution.status !== 'ready') {
          router.replace('/onboarding/role');
          return;
        }
        const patientId = pending?.patientId ?? saved?.session.patientId;
        if (patientId !== resolution.profile.id) {
          clear();
          router.dismissTo('/patient/games');
          return;
        }
        setLanguage(resolution.settings.language);
        setAccessibility({
          highContrast: resolution.settings.highContrast,
          reducedMotion: resolution.settings.reducedMotion,
          textSize: resolution.settings.textSize,
          voiceGuidance: resolution.settings.voiceGuidance,
        });
        setPreferredName(resolution.profile.preferredName);
        setSettings(resolution.settings);
        setStatus('ready');
      })
      .catch(() => {
        if (__DEV__) console.error('Activity result could not be prepared');
        if (active && current()) setStatus('failed');
      });
    return () => {
      active = false;
    };
  }, [clear, focused, loadAttempt, pending, router, saved, setAccessibility, setLanguage]);

  useEffect(() => {
    if (!saved || !removeAfterSave.current) return;
    const action = removeAfterSave.current;
    removeAfterSave.current = null;
    navigation.dispatch(action);
  }, [navigation, saved]);

  const submit = async (feedback: ActivityFeedbackLabel | null) => {
    const patientCurrent = capturePatientRequest();
    const current = () => {
      const active = useCognitiveSessionStore.getState().pending;
      return !!pending && live.current && patientCurrent() && active?.patientId === pending.patientId &&
        active.telemetry.gameType === pending.telemetry.gameType && active.telemetry.startedAtMs === pending.telemetry.startedAtMs &&
        active.telemetry.completedAtMs === pending.telemetry.completedAtMs;
    };
    if (!pending || !current() || submissionLocked.current) return false;
    submissionLocked.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const result = await saveCognitiveResult(pending, feedback);
      if (!current()) return false;
      setSaved(result);
      return true;
    } catch {
      if (__DEV__) console.error('Completed activity could not be saved');
      if (current()) setSaveFailed(true);
      return false;
    } finally {
      submissionLocked.current = false;
      if (live.current && patientCurrent()) setSaving(false);
    }
  };
  automaticSave.current = () => { void submit(null); };
  usePreventRemove(!!pending && !saved, ({ data }) => {
    if (submissionLocked.current) return;
    removeAfterSave.current = data.action;
    void submit(null).then(saved => { if (!saved) removeAfterSave.current = null; });
  });

  if (!settings || status !== 'ready' || (!pending && !saved)) {
    return (
      <ScreenWrapper contentContainerStyle={styles.centered} scroll>
        {status === 'failed' ? (
          <View style={styles.actions}>
            <ThemedText accessibilityRole="alert">{t(loadingLanguage, 'errorSafeTitle')}</ThemedText>
            <SmaranButton accessibilityLabel={t(loadingLanguage, 'retry')} label={t(loadingLanguage, 'retry')} onPress={() => setLoadAttempt((value) => value + 1)} />
            <SmaranButton accessibilityLabel={t(loadingLanguage, 'activitiesBack')} label={t(loadingLanguage, 'activitiesBack')} onPress={() => router.dismissTo('/patient/games')} variant="outline" />
          </View>
        ) : (
          <View style={styles.actions}>
            <SmaranLoading label={t(loadingLanguage, 'gameLoading')} />
          </View>
        )}
      </ScreenWrapper>
    );
  }

  const language = settings.language;
  const textSize = textSizeFor(settings);
  const metrics = saved?.session ?? pending?.telemetry;
  if (!metrics) return null;
  const activity = t(language, activityTitleKeys[metrics.gameType]);
  const completedSummary = activitySummary(language, metrics);
  const attempts = saved?.session.attempts ?? pending?.telemetry.attempts ?? 0;
  const hints = saved?.session.hintsUsed ?? pending?.telemetry.hintsUsed ?? 0;
  const recommendation = saved?.recommendation ?? pending?.initialRecommendation;
  if (!recommendation) return null;
  const recommendationText = t(language, recommendationKey(recommendation.direction));

  const readText = [
    t(language, 'resultTitle', { name: preferredName }), activity,
    t(language, 'activityFinished'), completedSummary,
    t(language, 'activityNextLevel', { level: String(recommendation.recommendedDifficulty) }),
    recommendationText,
    ...(!saved ? [t(language, 'resultQuestion'), ...feedbackOptions.map((option) => t(language, option.key)), t(language, 'skip')] : [t(language, 'whyLevel'), t(language, 'activitiesBack')]),
  ].join(' ');

  return (
    <ScreenWrapper contentContainerStyle={styles.screen} scroll>
      <View style={styles.content}>
        <View style={styles.controls}>
        {!saved && <SmaranButton style={styles.control} label={t(language, paused ? 'gameResume' : 'gamePause')} accessibilityLabel={t(language, paused ? 'gameResume' : 'gamePause')}
          variant={paused ? 'primary' : 'outline'} onPress={() => setPaused(value => !value)} />}
        <SmaranButton label={t(language, 'activitiesBack')} accessibilityLabel={t(language, 'activitiesBack')} variant="outline" disabled={saving}
          style={styles.control}
          onPress={() => { void (async () => {
            if (!saved && !await submit(null)) return;
            setPaused(true); router.dismissTo('/patient/games');
          })(); }} />
        </View>
        <PageIntro title={t(language, 'resultTitle', { name: preferredName })} icon="check-circle" />
        <View style={styles.completion}>
          <MaterialIcons name="check-circle" color={colors.success} size={32} accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <ThemedText textSize={textSize} type="action" style={{ flex: 1 }}>{t(language, 'activityFinished')}</ThemedText>
        </View>
        <SmaranCard style={[styles.summary, { borderColor: colors.success, backgroundColor: colors.successSurface }]}>
          <ThemedText textSize={textSize} type="cardHeading">{activity}</ThemedText>
          <ThemedText textSize={textSize}>{completedSummary}</ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'activityAccuracy', { accuracy: new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(metrics.accuracy) })}</ThemedText>
          <ThemedText textSize={textSize} type="secondary">{metrics.gameType === 'memory_match' ? t(language, 'factorAttempts', { value: String(attempts) }) : t(language, 'selectionsAttempts', { count: String(attempts) })}</ThemedText>
          <ThemedText textSize={textSize} type="secondary">{t(language, 'resultHints', { hints: String(hints) })}</ThemedText>
        </SmaranCard>
        <SmaranCard style={[styles.recommendation, { borderColor: colors.primary, backgroundColor: colors.surfaceSelected }]}>
          <ThemedText textSize={textSize} type="action">{t(language, 'activityNextLevel', { level: String(recommendation.recommendedDifficulty) })}</ThemedText>
          <ThemedText accessibilityLiveRegion="polite" textSize={textSize}>{recommendationText}</ThemedText>
        </SmaranCard>

        {!saved ? (
          <SmaranCard style={styles.feedback}>
            <ThemedText accessibilityRole="header" textSize={textSize} type="cardHeading">
              {t(language, 'resultQuestion')}
            </ThemedText>
            <ThemedText textSize={textSize} type="secondary">{t(language, 'optional')}</ThemedText>
            {feedbackOptions.map((option) => (
              <SmaranButton
                accessibilityLabel={t(language, option.key)}
                disabled={saving}
                key={option.label}
                label={t(language, option.key)}
                onPress={() => void submit(option.label)}
                variant={option.label === 'comfortable' ? 'secondary' : 'outline'}
              />
            ))}
            <SmaranButton
              accessibilityLabel={t(language, 'skip')}
              disabled={saving}
              loading={saving}
              label={saving ? t(language, 'gameSaving') : t(language, 'skip')}
              onPress={() => void submit(null)}
              variant="outline"
            />
            {saveFailed ? (
              <ThemedText accessibilityRole="alert" textSize={textSize}>{t(language, 'saveFailed')}</ThemedText>
            ) : null}
          </SmaranCard>
        ) : (
          <View style={styles.actions}>
            <SmaranButton accessibilityLabel={t(language, 'continue')} label={t(language, 'continue')}
              onPress={() => router.replace({ pathname: `/patient/games/${saved.session.gameType.replaceAll('_', '-')}`, params: { auto: '1' } } as Href)} />
            <SmaranButton
              accessibilityLabel={t(language, 'whyLevel')}
              label={t(language, 'whyLevel')}
              onPress={() =>
                router.push({ pathname: '/patient/games/why-level', params: { sessionId: saved.session.id } })
              }
              variant="outline"
            />
            <SmaranButton
              accessibilityLabel={t(language, 'activitiesBack')}
              label={t(language, 'activitiesBack')}
              onPress={() => {
                clear();
                router.dismissTo('/patient/games');
              }}
            />
          </View>
        )}
        {settings.voiceGuidance ? <ReadScreenButton language={language} text={readText} /> : null}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1 },
  content: PageLayout.content,
  centered: { flexGrow: 1, gap: Spacing.lg, justifyContent: 'center' },
  completion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summary: { gap: Spacing.sm },
  recommendation: { gap: Spacing.sm },
  feedback: { gap: Spacing.md },
  actions: { gap: Spacing.md },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  control: { flexGrow: 1, flexBasis: 240 },
});
