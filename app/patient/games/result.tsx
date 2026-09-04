import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { recommendDifficulty } from '@ai/adaptive-engine';
import { updateModelFromOptionalFeedback } from '@ai/online-trainer';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Colors } from '@constants/colors';
import { Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { cognitiveRepository } from '@db/repositories/cognitive.repository';
import type { ActivityFeedbackLabel, PatientSettings } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCognitiveSessionStore } from '@/src/stores/cognitive-session.store';

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

export default function MemoryMatchResultScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const pending = useCognitiveSessionStore((state) => state.pending);
  const saved = useCognitiveSessionStore((state) => state.saved);
  const setSaved = useCognitiveSessionStore((state) => state.setSaved);
  const clear = useCognitiveSessionStore((state) => state.clear);
  const [settings, setSettings] = useState<PatientSettings | null>(null);
  const [status, setStatus] = useState<ResultStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const submissionLocked = useRef(false);

  useEffect(() => {
    let active = true;
    if (!pending && !saved) {
      router.replace('/patient/home');
      return;
    }
    resolveActivePatient()
      .then((resolution) => {
        if (!active) return;
        if (resolution.status !== 'ready') {
          router.replace('/onboarding/role');
          return;
        }
        const patientId = pending?.patientId ?? saved?.session.patientId;
        if (patientId !== resolution.profile.id) {
          clear();
          router.replace('/patient/home');
          return;
        }
        setSettings(resolution.settings);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (__DEV__) console.error('Activity result could not be prepared', error);
        if (active) setStatus('failed');
      });
    return () => {
      active = false;
    };
  }, [clear, pending, router, saved]);

  if (!settings || status !== 'ready' || (!pending && !saved)) {
    return (
      <ScreenWrapper contentContainerStyle={styles.centered}>
        {status === 'failed' ? (
          <SmaranButton
            accessibilityLabel={t('en', 'backHome')}
            label={t('en', 'backHome')}
            onPress={() => router.replace('/patient/home')}
          />
        ) : (
          <ActivityIndicator accessibilityLabel={t('en', 'gameLoading')} color={Colors[colorScheme].primary} size="large" />
        )}
      </ScreenWrapper>
    );
  }

  const language = settings.language;
  const textSize = textSizeFor(settings);
  const pairs = saved?.session.totalPairs ?? pending?.telemetry.totalPairs ?? 0;
  const attempts = saved?.session.attempts ?? pending?.telemetry.attempts ?? 0;
  const hints = saved?.session.hintsUsed ?? pending?.telemetry.hintsUsed ?? 0;
  const recommendation = saved?.recommendation ?? pending?.initialRecommendation;
  if (!recommendation) return null;
  const recommendationText = t(language, recommendationKey(recommendation.direction));

  const submit = async (feedback: ActivityFeedbackLabel | null) => {
    if (!pending || submissionLocked.current) return;
    submissionLocked.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const modelAfterFeedback = updateModelFromOptionalFeedback(
        pending.model,
        pending.extraction.features,
        feedback,
        new Date().toISOString()
      );
      const finalRecommendation = recommendDifficulty(
        pending.currentDifficulty,
        pending.extraction.features,
        modelAfterFeedback
      );
      const session = await cognitiveRepository.saveCompletedSession(
        {
          accuracy: pending.telemetry.accuracy,
          attempts: pending.telemetry.attempts,
          averageResponseMs: pending.telemetry.averageResponseMs,
          completedAt: new Date(pending.telemetry.completedAtMs).toISOString(),
          difficulty: pending.currentDifficulty,
          feedbackLabel: feedback,
          gameType: 'memory_match',
          hintsUsed: pending.telemetry.hintsUsed,
          matches: pending.telemetry.matches,
          patientId: pending.patientId,
          recommendedDifficulty: finalRecommendation.recommendedDifficulty,
          repeatedMistakes: pending.telemetry.repeatedMistakes,
          startedAt: new Date(pending.telemetry.startedAtMs).toISOString(),
          totalPairs: pending.telemetry.totalPairs,
        },
        feedback === null ? undefined : modelAfterFeedback
      );
      setSaved({ feedback, recommendation: finalRecommendation, session });
    } catch (error) {
      if (__DEV__) console.error('Completed Memory Match session could not be saved', error);
      setSaveFailed(true);
      submissionLocked.current = false;
    } finally {
      setSaving(false);
    }
  };

  const readText = [
    t(language, 'resultTitle'),
    t(language, 'resultSummaryPairs', { pairs: String(pairs) }),
    t(language, 'resultAttempts', { attempts: String(attempts) }),
    t(language, 'resultHints', { hints: String(hints) }),
    recommendationText,
  ].join(' ');

  return (
    <ScreenWrapper contentContainerStyle={styles.screen} scroll>
      <View style={styles.content}>
        <ThemedText accessibilityRole="header" textSize={textSize} type="screenTitle">
          {t(language, 'resultTitle')}
        </ThemedText>
        <SmaranCard style={styles.summary}>
          <ThemedText textSize={textSize} type="cardHeading">
            {t(language, 'gameComplete')}
          </ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'resultSummaryPairs', { pairs: String(pairs) })}</ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'resultAttempts', { attempts: String(attempts) })}</ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'resultHints', { hints: String(hints) })}</ThemedText>
        </SmaranCard>

        <SmaranCard selected style={styles.recommendation}>
          <ThemedText textSize={textSize} type="defaultSemiBold">{recommendationText}</ThemedText>
        </SmaranCard>

        {settings.voiceGuidance ? <ReadScreenButton language={language} text={readText} /> : null}

        {!saved ? (
          <View style={styles.feedback}>
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
              label={saving ? t(language, 'gameSaving') : t(language, 'skip')}
              onPress={() => void submit(null)}
              variant="outline"
            />
            {saveFailed ? (
              <ThemedText accessibilityRole="alert" textSize={textSize}>{t(language, 'saveFailed')}</ThemedText>
            ) : null}
          </View>
        ) : (
          <View style={styles.actions}>
            <SmaranButton
              accessibilityLabel={t(language, 'whyLevel')}
              label={t(language, 'whyLevel')}
              onPress={() =>
                router.push({ pathname: '/patient/games/why-level', params: { sessionId: saved.session.id } })
              }
              variant="outline"
            />
            <SmaranButton
              accessibilityLabel={t(language, 'backHome')}
              label={t(language, 'backHome')}
              onPress={() => {
                clear();
                router.replace('/patient/home');
              }}
            />
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1 },
  content: { alignSelf: 'center', gap: Spacing.lg, maxWidth: 640, width: '100%' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  summary: { gap: Spacing.sm },
  recommendation: { gap: Spacing.sm },
  feedback: { gap: Spacing.md },
  actions: { gap: Spacing.md },
});
