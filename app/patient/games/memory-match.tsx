import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View, useWindowDimensions } from 'react-native';

import { createInitialAdaptiveModel, recommendDifficulty } from '@ai/adaptive-engine';
import { extractAdaptiveFeatures } from '@ai/feature-extractor';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { EncouragementBanner } from '@components/feedback/encouragement-banner';
import { MemoryCard } from '@components/games/memory-card';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Colors } from '@constants/colors';
import { Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { cognitiveRepository } from '@db/repositories/cognitive.repository';
import type { AdaptiveModelState, CognitiveSession, PatientSettings } from '@db/schema.types';
import { t } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCognitiveSessionStore } from '@/src/stores/cognitive-session.store';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { getMemorySymbol } from '@/src/games/memory-match/assets';
import { INITIAL_MEMORY_DIFFICULTY, MemoryDifficulties } from '@/src/games/memory-match/difficulty';
import {
  clearHint,
  createMemoryGame,
  flipCard,
  requestHint,
  resolveComparison,
  startPlaying,
  startPreview,
} from '@/src/games/memory-match/engine';
import {
  createTelemetry,
  finalizeTelemetry,
  recordComparison,
  recordFirstFlip,
  recordHint,
  resumeTelemetry,
  type MemoryTelemetryState,
} from '@/src/games/memory-match/telemetry';
import type { MemoryGameState } from '@/src/games/memory-match/types';

type GameData = {
  history: readonly CognitiveSession[];
  model: AdaptiveModelState;
  patientId: string;
  settings: PatientSettings;
};

type LoadStatus = 'loading' | 'ready' | 'failed';
type FeedbackCue = 'match' | 'almost' | null;

function textSizeFor(settings: PatientSettings): TextSizePreference {
  if (settings.textSize === 'standard') return 'normal';
  return settings.textSize === 'extra-large' ? 'extraLarge' : 'large';
}

export default function MemoryMatchScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const setPending = useCognitiveSessionStore((state) => state.setPending);
  const clearSession = useCognitiveSessionStore((state) => state.clear);
  const loadingLanguage = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<GameData | null>(null);
  const [difficulty, setDifficulty] = useState(INITIAL_MEMORY_DIFFICULTY);
  const [game, setGame] = useState<MemoryGameState>(() => createMemoryGame(INITIAL_MEMORY_DIFFICULTY));
  const [feedbackCue, setFeedbackCue] = useState<FeedbackCue>(null);
  const telemetry = useRef<MemoryTelemetryState | null>(null);
  const completionStarted = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((task: () => void, delay: number) => {
    const timer = setTimeout(task, delay);
    timers.current.push(timer);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    let active = true;
    setLoadStatus('loading');
    clearSession();

    resolveActivePatient()
      .then(async (resolution) => {
        if (resolution.status !== 'ready') {
          if (active) router.replace('/onboarding/role');
          return;
        }
        const [history, savedModel] = await Promise.all([
          cognitiveRepository.getRecentSessions(resolution.profile.id, 5),
          cognitiveRepository.getAdaptiveModel(resolution.profile.id),
        ]);
        if (!active) return;
        setLanguage(resolution.settings.language);
        const nextDifficulty = history[0]?.recommendedDifficulty ?? INITIAL_MEMORY_DIFFICULTY;
        setDifficulty(nextDifficulty);
        setGame(createMemoryGame(nextDifficulty));
        setData({
          history,
          model: savedModel ?? createInitialAdaptiveModel(resolution.profile.id),
          patientId: resolution.profile.id,
          settings: resolution.settings,
        });
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (__DEV__) console.error('Memory Match could not be prepared', error);
        if (active) setLoadStatus('failed');
      });

    return () => {
      active = false;
    };
  }, [clearSession, loadAttempt, router, setLanguage]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && telemetry.current) {
        telemetry.current = resumeTelemetry(telemetry.current, Date.now());
      }
    });
    return () => subscription.remove();
  }, []);

  if (loadStatus !== 'ready' || !data) {
    return (
      <ScreenWrapper contentContainerStyle={styles.centered}>
        {loadStatus === 'failed' ? (
          <>
            <ThemedText accessibilityRole="alert">{t(loadingLanguage, 'gameLoadFailed')}</ThemedText>
            <SmaranButton
              accessibilityLabel={t(loadingLanguage, 'gameRetry')}
              label={t(loadingLanguage, 'gameRetry')}
              onPress={() => setLoadAttempt((value) => value + 1)}
            />
            <SmaranButton
              accessibilityLabel={t(loadingLanguage, 'backHome')}
              label={t(loadingLanguage, 'backHome')}
              onPress={() => router.replace('/patient/home')}
              variant="outline"
            />
          </>
        ) : (
          <>
            <ActivityIndicator accessibilityLabel={t(loadingLanguage, 'gameLoading')} color={colors.primary} size="large" />
            <ThemedText>{t(loadingLanguage, 'gameLoading')}</ThemedText>
          </>
        )}
      </ScreenWrapper>
    );
  }

  const { settings } = data;
  const language = settings.language;
  const textSize = textSizeFor(settings);
  const config = MemoryDifficulties[difficulty];
  const availableBoardWidth = Math.min(480, Math.max(0, width - Spacing.xl));
  const cardSize = Math.min(
    112,
    Math.floor((availableBoardWidth - Spacing.md * (config.columns - 1)) / config.columns)
  );
  const boardWidth = cardSize * config.columns + Spacing.md * (config.columns - 1);
  const matchedPairs = game.cards.filter(({ state }) => state === 'matched').length / 2;

  const leave = () => {
    clearSession();
    router.replace('/patient/home');
  };

  const begin = () => {
    completionStarted.current = false;
    const preview = startPreview(game);
    setGame(preview);
    setFeedbackCue(null);
    schedule(() => {
      const now = Date.now();
      telemetry.current = createTelemetry(now);
      setGame((current) => startPlaying(current));
    }, 1800);
  };

  const finish = (finalTelemetry: MemoryTelemetryState) => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    const completed = finalizeTelemetry(finalTelemetry, config.pairs, Date.now());
    const extraction = extractAdaptiveFeatures({
      currentDifficulty: difficulty,
      patientId: data.patientId,
      recentSessions: data.history,
      telemetry: completed,
    });
    const initialRecommendation = recommendDifficulty(difficulty, extraction.features, data.model);
    setPending({
      currentDifficulty: difficulty,
      extraction,
      initialRecommendation,
      model: data.model,
      patientId: data.patientId,
      telemetry: completed,
    });
    schedule(() => router.replace('/patient/games/result'), settings.reducedMotion ? 0 : 700);
  };

  const handleCardPress = (index: number) => {
    const next = flipCard(game, index);
    if (next.state === game) return;
    const now = Date.now();
    if (next.comparedSymbols === null) {
      if (telemetry.current) telemetry.current = recordFirstFlip(telemetry.current, now);
      setGame(next.state);
      return;
    }

    if (!telemetry.current) return;
    const updatedTelemetry = recordComparison(
      telemetry.current,
      next.comparedSymbols,
      next.isMatch === true,
      now
    );
    telemetry.current = updatedTelemetry;
    setGame(next.state);
    setFeedbackCue(next.isMatch ? 'match' : 'almost');

    if (next.state.status === 'SESSION_COMPLETE') {
      finish(updatedTelemetry);
      return;
    }
    schedule(() => {
      setGame((current) => resolveComparison(current));
      setFeedbackCue(null);
    }, next.isMatch ? 650 : 950);
  };

  const handleHint = () => {
    const next = requestHint(game);
    if (next === game) return;
    if (telemetry.current) telemetry.current = recordHint(telemetry.current);
    setGame(next);
    schedule(() => setGame((current) => clearHint(current)), 1500);
  };

  const speechText = `${t(language, 'gameTitle')}. ${t(language, 'gameInstructions')} ${t(language, 'gameHintPrompt')} ${t(language, 'gameHint')}.`;

  return (
    <ScreenWrapper contentContainerStyle={styles.screen} scroll>
      <View style={styles.content}>
        <View style={styles.navigation}>
          <SmaranButton accessibilityLabel={t(language, 'backHome')} label={t(language, 'backHome')} onPress={leave} variant="outline" />
        </View>
        <View style={styles.heading}>
          <ThemedText accessibilityRole="header" textSize={textSize} type="screenTitle">
            {t(language, 'gameTitle')}
          </ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'gameInstructions')}</ThemedText>
          <ThemedText textSize={textSize} type="defaultSemiBold">
            {t(language, 'gameLevel', { level: String(difficulty) })}
          </ThemedText>
        </View>

        {settings.voiceGuidance ? <ReadScreenButton language={language} text={speechText} /> : null}

        {game.status === 'IDLE' ? (
          <SmaranButton
            accessibilityLabel={t(language, 'gameStart')}
            label={t(language, 'gameStart')}
            onPress={begin}
            reducedMotionOverride={settings.reducedMotion ? true : null}
            size="large"
          />
        ) : (
          <>
            <View style={styles.progressRow}>
              <ThemedText textSize={textSize} type="defaultSemiBold">
                {game.status === 'PREVIEW'
                  ? t(language, 'gamePreview')
                  : t(language, 'gamePairsFound', {
                      matched: String(matchedPairs),
                      total: String(config.pairs),
                    })}
              </ThemedText>
            </View>
            <View style={[styles.board, { gap: Spacing.md, width: boardWidth }]}>
              {game.cards.map((card, index) => {
                const symbol = getMemorySymbol(card.symbolId);
                const shownState = game.hintedCardIds.includes(card.id) ? 'revealed' : card.state;
                const labelKey =
                  shownState === 'hidden' ? 'cardHidden' : shownState === 'matched' ? 'cardMatched' : 'cardRevealed';
                return (
                  <MemoryCard
                    accessibilityLabel={t(language, labelKey, {
                      position: String(index + 1),
                      symbol: t(language, symbol.labelKey),
                    })}
                    disabled={game.inputLocked || card.state === 'matched' || game.status !== 'PLAYING'}
                    highContrast={settings.highContrast}
                    hinted={game.hintedCardIds.includes(card.id)}
                    key={card.id}
                    onPress={() => handleCardPress(index)}
                    reducedMotion={settings.reducedMotion}
                    size={Math.max(config.minimumCardSize, cardSize)}
                    state={card.state}
                    symbol={symbol}
                  />
                );
              })}
            </View>
            {feedbackCue ? (
              <EncouragementBanner
                message={t(language, feedbackCue === 'match' ? 'gameMatch' : 'gameAlmost')}
                reducedMotionOverride={settings.reducedMotion ? true : null}
                tone={feedbackCue === 'match' ? 'success' : 'retry'}
              />
            ) : null}
            {game.status === 'PLAYING' ? (
              <View style={[styles.hintPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText textSize={textSize}>{t(language, 'gameHintPrompt')}</ThemedText>
                <SmaranButton
                  accessibilityLabel={t(language, 'gameHint')}
                  disabled={game.inputLocked || game.firstCardIndex !== null}
                  icon={<MaterialIcons color={colors.text} name="lightbulb-outline" size={26} />}
                  label={t(language, 'gameHint')}
                  onPress={handleHint}
                  variant="outline"
                />
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: Spacing.md },
  content: { alignSelf: 'center', gap: Spacing.lg, maxWidth: 680, width: '100%' },
  centered: { alignItems: 'center', gap: Spacing.lg, justifyContent: 'center' },
  navigation: { alignItems: 'flex-start' },
  heading: { gap: Spacing.sm },
  progressRow: { alignItems: 'center' },
  board: { alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  hintPanel: { borderRadius: Radius.card, borderWidth: 1, gap: Spacing.md, padding: Spacing.md },
});
