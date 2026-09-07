import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { createInitialAdaptiveModel, recommendDifficulty } from '@ai/adaptive-engine';
import { chooseExplanationTemplate } from '@ai/explanation';
import { extractAdaptiveFeatures } from '@ai/feature-extractor';
import { sessionTelemetry } from '@/src/games/telemetry';
import { activitySummary, activityTitleKeys } from '@/src/games/presentation';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { cognitiveRepository } from '@db/repositories/cognitive.repository';
import type { CognitiveSession, PatientSettings } from '@db/schema.types';
import { t } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
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
  const focused = useIsFocused();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const colors = useThemeColors();
  const loadingLanguage = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);
  const [data, setData] = useState<WhyData | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    setFailed(false);
    if (!sessionId) {
      router.dismissTo('/patient/games');
      return;
    }

    resolveActivePatient()
      .then(async (resolution) => {
        const session = resolution.status === 'ready' ? await cognitiveRepository.getSessionById(resolution.profile.id, sessionId) : null;
        if (!active) return;
        if (resolution.status !== 'ready' || !session || session.patientId !== resolution.profile.id) {
          router.dismissTo('/patient/games');
          return;
        }
        const [recentSessions, savedModel] = await Promise.all([
          cognitiveRepository.getRecentSessions(session.patientId, 5, session.gameType, session.completedAt),
          cognitiveRepository.getAdaptiveModel(session.patientId, session.gameType),
        ]);
        if (!active) return;
        setLanguage(resolution.settings.language);
        setAccessibility({
          highContrast: resolution.settings.highContrast,
          reducedMotion: resolution.settings.reducedMotion,
          textSize: resolution.settings.textSize,
          voiceGuidance: resolution.settings.voiceGuidance,
        });
        const history = recentSessions.filter(({ id }) => id !== session.id).slice(0, 5);
        const extraction = extractAdaptiveFeatures({
          currentDifficulty: session.difficulty,
          patientId: session.patientId,
          recentSessions: history,
          telemetry: sessionTelemetry(session),
        });
        const computed = recommendDifficulty(
          session.difficulty,
          extraction.features,
          savedModel ?? createInitialAdaptiveModel(session.patientId, session.gameType)
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
          explanationKey: chooseExplanationTemplate(recommendation, extraction, session.gameType),
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
  }, [focused, loadAttempt, router, sessionId, setAccessibility, setLanguage]);

  if (!data) {
    return (
      <ScreenWrapper contentContainerStyle={styles.centered} scroll>
        {failed ? (
          <View style={styles.actions}>
            <ThemedText accessibilityRole="alert">{t(loadingLanguage, 'errorSafeTitle')}</ThemedText>
            <SmaranButton accessibilityLabel={t(loadingLanguage, 'retry')} label={t(loadingLanguage, 'retry')} onPress={() => setLoadAttempt((value) => value + 1)} />
            <SmaranButton accessibilityLabel={t(loadingLanguage, 'activitiesBack')} label={t(loadingLanguage, 'activitiesBack')} onPress={() => router.dismissTo('/patient/games')} variant="outline" />
          </View>
        ) : (
          <View style={styles.actions}>
            <ActivityIndicator accessibilityLabel={t(loadingLanguage, 'gameLoading')} color={colors.primary} size="large" />
            <ThemedText>{t(loadingLanguage, 'gameLoading')}</ThemedText>
          </View>
        )}
      </ScreenWrapper>
    );
  }

  const { session, settings, explanationKey } = data;
  const language = settings.language;
  const textSize = textSizeFor(settings);
  const activity = t(language, activityTitleKeys[session.gameType]);
  const explanation = t(language, explanationKey, { activity });
  const recommendationText = t(language, session.recommendedDifficulty < session.difficulty ? 'recommendationGentler' : session.recommendedDifficulty > session.difficulty ? 'recommendationChallenge' : 'recommendationHold');
  const facts = [
    session.gameType === 'memory_match' ? t(language, 'factorPairs', { value: `${session.matches} / ${session.totalPairs}` }) : activitySummary(language, session),
    t(language, 'factorHints', { value: String(session.hintsUsed) }),
    t(language, 'careAdaptive'),
  ];
  const readText = [
    t(language, 'whyTitle'), activity,
    t(language, 'nextTime'),
    recommendationText,
    ...facts,
    explanation,
    t(language, 'personalizationDisclaimer'),
  ].join(' ');

  return (
    <ScreenWrapper contentContainerStyle={styles.screen} scroll>
      <View style={styles.content}>
        <ThemedText accessibilityRole="header" textSize={textSize} type="screenTitle">
          {t(language, 'whyTitle')}
        </ThemedText>
        <ThemedText textSize={textSize} type="cardHeading">{activity}</ThemedText>
        <SmaranCard style={styles.facts}>
          <ThemedText textSize={textSize} type="secondary">{t(language, 'nextTime')}</ThemedText>
          <ThemedText textSize={textSize} type="cardHeading">{recommendationText}</ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'gameLevel', { level: String(session.recommendedDifficulty) })}</ThemedText>
        </SmaranCard>
        <SmaranCard style={styles.facts}>
          <ThemedText textSize={textSize}>{explanation}</ThemedText>
          {facts.map((fact) => (
            <ThemedText key={fact} textSize={textSize}>{fact}</ThemedText>
          ))}
        </SmaranCard>
        <ThemedText textSize={textSize} type="secondary">{t(language, 'personalizationDisclaimer')}</ThemedText>
        {settings.voiceGuidance ? <ReadScreenButton language={language} text={readText} /> : null}
        <View style={styles.actions}>
          <SmaranButton accessibilityLabel={t(language, 'back')} label={t(language, 'back')} onPress={() => router.canGoBack() ? router.back() : router.dismissTo('/patient/games')} variant="outline" />
          <SmaranButton accessibilityLabel={t(language, 'activitiesBack')} label={t(language, 'activitiesBack')} onPress={() => router.dismissTo('/patient/games')} />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1 },
  content: { alignSelf: 'center', gap: Spacing.lg, maxWidth: 640, width: '100%' },
  centered: { flexGrow: 1, gap: Spacing.lg, justifyContent: 'center' },
  facts: { gap: Spacing.md },
  actions: { gap: Spacing.md },
});
