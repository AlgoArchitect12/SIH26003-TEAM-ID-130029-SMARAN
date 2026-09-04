import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { createInitialAdaptiveModel, recommendDifficulty } from '@ai/adaptive-engine';
import { chooseExplanationTemplate } from '@ai/explanation';
import { extractAdaptiveFeatures } from '@ai/feature-extractor';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Colors } from '@constants/colors';
import { Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { cognitiveRepository } from '@db/repositories/cognitive.repository';
import type { CognitiveSession, PatientSettings } from '@db/schema.types';
import { t } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

import type { AdaptiveDirection, FeatureExtraction } from '@ai/types';

type WhyData = {
  extraction: FeatureExtraction;
  explanationKey: ReturnType<typeof chooseExplanationTemplate>;
  session: CognitiveSession;
  settings: PatientSettings;
};

function textSizeFor(settings: PatientSettings): TextSizePreference {
  if (settings.textSize === 'standard') return 'normal';
  return settings.textSize === 'extra-large' ? 'extraLarge' : 'large';
}

export default function WhyLevelScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const loadingLanguage = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const [data, setData] = useState<WhyData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!sessionId) {
      router.replace('/patient/home');
      return;
    }

    Promise.all([resolveActivePatient(), cognitiveRepository.getSessionById(sessionId)])
      .then(async ([resolution, session]) => {
        if (!active) return;
        if (resolution.status !== 'ready' || !session || session.patientId !== resolution.profile.id) {
          router.replace('/patient/home');
          return;
        }
        const [recentSessions, savedModel] = await Promise.all([
          cognitiveRepository.getRecentSessions(session.patientId, 6),
          cognitiveRepository.getAdaptiveModel(session.patientId),
        ]);
        if (!active) return;
        setLanguage(resolution.settings.language);
        const history = recentSessions.filter(({ id }) => id !== session.id).slice(0, 5);
        const extraction = extractAdaptiveFeatures({
          currentDifficulty: session.difficulty,
          patientId: session.patientId,
          recentSessions: history,
          telemetry: {
            accuracy: session.accuracy,
            attempts: session.attempts,
            averageResponseMs: session.averageResponseMs,
            completedAtMs: Date.parse(session.completedAt),
            hintsUsed: session.hintsUsed,
            idleTimeBeforeFirstFlipMs: 0,
            matches: session.matches,
            repeatedMistakes: session.repeatedMistakes,
            startedAtMs: Date.parse(session.startedAt),
            totalPairs: session.totalPairs,
          },
        });
        const computed = recommendDifficulty(
          session.difficulty,
          extraction.features,
          savedModel ?? createInitialAdaptiveModel(session.patientId)
        );
        const direction: AdaptiveDirection =
          session.recommendedDifficulty < session.difficulty
            ? 'gentler'
            : session.recommendedDifficulty > session.difficulty
              ? 'challenge'
              : 'hold';
        const recommendation = {
          ...computed,
          direction,
          recommendedDifficulty: session.recommendedDifficulty,
        };
        setData({
          explanationKey: chooseExplanationTemplate(recommendation, extraction),
          extraction,
          session,
          settings: resolution.settings,
        });
      })
      .catch((error: unknown) => {
        if (__DEV__) console.error('Activity explanation could not be prepared', error);
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [router, sessionId, setLanguage]);

  if (!data) {
    return (
      <ScreenWrapper contentContainerStyle={styles.centered}>
        {failed ? (
          <SmaranButton accessibilityLabel={t(loadingLanguage, 'backHome')} label={t(loadingLanguage, 'backHome')} onPress={() => router.replace('/patient/home')} />
        ) : (
          <ActivityIndicator accessibilityLabel={t(loadingLanguage, 'gameLoading')} color={Colors[colorScheme].primary} size="large" />
        )}
      </ScreenWrapper>
    );
  }

  const { extraction, session, settings, explanationKey } = data;
  const language = settings.language;
  const textSize = textSizeFor(settings);
  const explanation = t(language, explanationKey);
  const paceKey = extraction.hasPersonalBaseline ? 'factorPaceSimilar' : 'factorPaceLearning';
  const facts = [
    t(language, 'factorPairs', { value: `${session.matches} / ${session.totalPairs}` }),
    t(language, 'factorAttempts', { value: String(session.attempts) }),
    t(language, 'factorHints', { value: String(session.hintsUsed) }),
    t(language, paceKey),
  ];
  const readText = [
    t(language, 'whyTitle', { level: String(session.recommendedDifficulty) }),
    explanation,
    ...facts,
    t(language, 'personalizationDisclaimer'),
  ].join(' ');

  return (
    <ScreenWrapper contentContainerStyle={styles.screen} scroll>
      <View style={styles.content}>
        <ThemedText accessibilityRole="header" textSize={textSize} type="screenTitle">
          {t(language, 'whyTitle', { level: String(session.recommendedDifficulty) })}
        </ThemedText>
        <SmaranCard selected>
          <ThemedText textSize={textSize}>{explanation}</ThemedText>
        </SmaranCard>
        <SmaranCard style={styles.facts}>
          {facts.map((fact) => (
            <ThemedText key={fact} textSize={textSize}>{fact}</ThemedText>
          ))}
        </SmaranCard>
        <ThemedText textSize={textSize} type="secondary">{t(language, 'personalizationDisclaimer')}</ThemedText>
        {settings.voiceGuidance ? <ReadScreenButton language={language} text={readText} /> : null}
        <View style={styles.actions}>
          <SmaranButton accessibilityLabel={t(language, 'back')} label={t(language, 'back')} onPress={() => router.back()} variant="outline" />
          <SmaranButton accessibilityLabel={t(language, 'backHome')} label={t(language, 'backHome')} onPress={() => router.replace('/patient/home')} />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1 },
  content: { alignSelf: 'center', gap: Spacing.lg, maxWidth: 640, width: '100%' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  facts: { gap: Spacing.md },
  actions: { gap: Spacing.md },
});
