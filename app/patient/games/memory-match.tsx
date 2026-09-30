import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { useGameTransition } from '@/hooks/use-game-transition';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';

import { createInitialAdaptiveModel, recommendDifficulty } from '@ai/adaptive-engine';
import { extractAdaptiveFeatures } from '@ai/feature-extractor';
import { coachAnswer, coachHint, coachHintKey, initialCoach, type CoachState } from '@ai/cognitive-coach';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { EncouragementBanner } from '@components/feedback/encouragement-banner';
import { MemoryCard } from '@components/games/memory-card';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Radius, Spacing } from '@constants/layout';
import type { TextSizePreference } from '@constants/typography';
import { cognitiveRepository } from '@db/repositories/cognitive.repository';
import type { AdaptiveModelState, CognitiveSession, PatientSettings } from '@db/schema.types';
import { t } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useCognitiveSessionStore } from '@/src/stores/cognitive-session.store';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { getMemorySymbol } from '@/src/games/memory-match/assets';
import { INITIAL_MEMORY_DIFFICULTY, MemoryDifficulties } from '@/src/games/memory-match/difficulty';
import {
  createMemoryGame,
  flipCard,
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
  isCurrent: () => boolean;
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
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { width } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const colors = useThemeColors();
  const setPending = useCognitiveSessionStore((state) => state.setPending);
  const clearSession = useCognitiveSessionStore((state) => state.clear);
  const loadingLanguage = useOnboardingStore((state) => state.language) ?? 'en';
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<GameData | null>(null);
  const [difficulty, setDifficulty] = useState(INITIAL_MEMORY_DIFFICULTY);
  const [game, setGame] = useState<MemoryGameState>(() => createMemoryGame(INITIAL_MEMORY_DIFFICULTY));
  const gameRef = useRef(game);
  const updateGame = (next: MemoryGameState) => { gameRef.current = next; setGame(next); };
  const [coach, setCoach] = useState<CoachState>(initialCoach);
  const coachRef = useRef(coach);
  const updateCoach = (next: CoachState) => { coachRef.current = next; setCoach(next); };
  const [feedbackCue, setFeedbackCue] = useState<FeedbackCue>(null);
  const [paused, setPaused] = useState(false);
  const telemetry = useRef<MemoryTelemetryState | null>(null);
  const completionStarted = useRef(false);
  const lastFlip = useRef<number | null>(null);
  useGameTransition(game.status === 'SESSION_COMPLETE' ? 700 : null, () => {
    if (data?.isCurrent() && completionStarted.current) router.replace('/patient/games/result');
  }, paused);

  useGameTransition(game.status === 'PREVIEW' ? 4000 : feedbackCue && game.status !== 'SESSION_COMPLETE' ? 1400 : null, () => {
    if (!data?.isCurrent()) return;
    if (gameRef.current.status === 'PREVIEW') {
      telemetry.current = createTelemetry(Date.now());
      updateGame(startPlaying(gameRef.current));
    } else {
      if (gameRef.current.status === 'MATCH_CELEBRATION') updateCoach(initialCoach);
      updateGame(resolveComparison(gameRef.current));
      if (telemetry.current) telemetry.current = resumeTelemetry(telemetry.current, Date.now());
      setFeedbackCue(null);
    }
  }, paused);

  useEffect(() => {
    let active = true;
    const current = capturePatientRequest();
    setLoadStatus('loading');
    clearSession();

    resolveActivePatient()
      .then(async (resolution) => {
        if (resolution.status !== 'ready') {
          if (active && current()) router.replace('/onboarding/role');
          return;
        }
        const [history, savedModel] = await Promise.all([
          cognitiveRepository.getRecentSessions(resolution.profile.id, 5, 'memory_match'),
          cognitiveRepository.getAdaptiveModel(resolution.profile.id, 'memory_match'),
        ]);
        if (!active || !current()) return;
        setLanguage(resolution.settings.language);
        setAccessibility({
          highContrast: resolution.settings.highContrast,
          reducedMotion: resolution.settings.reducedMotion,
          textSize: resolution.settings.textSize,
          voiceGuidance: resolution.settings.voiceGuidance,
        });
        const nextDifficulty = history[0]?.recommendedDifficulty ?? INITIAL_MEMORY_DIFFICULTY;
        setDifficulty(nextDifficulty);
        const prepared = auto === '1' ? startPreview(createMemoryGame(nextDifficulty)) : createMemoryGame(nextDifficulty);
        gameRef.current = prepared; setGame(prepared);
        setData({
          isCurrent: () => active && current(),
          history,
          model: savedModel ?? createInitialAdaptiveModel(resolution.profile.id, 'memory_match'),
          patientId: resolution.profile.id,
          settings: resolution.settings,
        });
        setLoadStatus('ready');
      })
      .catch(() => {
        if (__DEV__) console.error('Memory Match could not be prepared');
        if (active && current()) setLoadStatus('failed');
      });

    return () => {
      active = false;
    };
  }, [auto, clearSession, loadAttempt, router, setAccessibility, setLanguage]);

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
      <ScreenWrapper contentContainerStyle={styles.centered} scroll>
        {loadStatus === 'failed' ? (
          <>
            <ThemedText accessibilityRole="alert">{t(loadingLanguage, 'gameLoadFailed')}</ThemedText>
            <SmaranButton
              accessibilityLabel={t(loadingLanguage, 'gameRetry')}
              label={t(loadingLanguage, 'gameRetry')}
              onPress={() => setLoadAttempt((value) => value + 1)}
            />
            <SmaranButton
              accessibilityLabel={t(loadingLanguage, 'activitiesBack')}
              label={t(loadingLanguage, 'activitiesBack')}
              onPress={() => router.dismissTo('/patient/games')}
              variant="outline"
            />
          </>
        ) : (
          <>
            <SmaranLoading label={t(loadingLanguage, 'gameLoading')} />
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
  const availableBoardWidth = Math.min(480, contentWidth || Math.max(0, width - Spacing.xl));
  const columns = Math.min(config.columns, Math.max(1, Math.floor((availableBoardWidth + Spacing.md) / (96 + Spacing.md))));
  const cardSize = Math.min(144, Math.floor((availableBoardWidth - Spacing.md * (columns - 1)) / columns));
  const boardWidth = cardSize * columns + Spacing.md * (columns - 1);
  const matchedPairs = game.cards.filter(({ state }) => state === 'matched').length / 2;
  const supportSymbol = game.cards.find(card => card.state !== 'matched')?.symbolId;
  const supportPositions = game.cards.flatMap((card, index) => card.state !== 'matched' && card.symbolId === supportSymbol ? [index] : []);
  const hintKey = coachHintKey('memory_match', coach);
  const hintText = hintKey ? t(language, hintKey, { position: String(supportPositions[0] + 1),
    first: String(supportPositions[0] + 1), second: String(supportPositions[1] + 1) }) : '';
  const feedbackText = feedbackCue ? t(language, feedbackCue === 'match' ? 'coachCorrect' : coach.wrongAnswers === 1 ? 'coachWrong' : 'coachTogether') : '';

  const leave = () => {
    clearSession();
    router.dismissTo('/patient/games');
  };

  const begin = () => {
    if (!data.isCurrent() || gameRef.current.status !== 'IDLE') return;
    completionStarted.current = false;
    updateGame(startPreview(gameRef.current));
    updateCoach(initialCoach);
    setFeedbackCue(null);
  };

  const finish = (finalTelemetry: MemoryTelemetryState) => {
    if (!data.isCurrent() || completionStarted.current) return;
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
  };

  const handleCardPress = (index: number) => {
    if (paused || !data.isCurrent() || (coachRef.current.hintLevel >= 3 && !supportPositions.includes(index))) return;
    const next = flipCard(gameRef.current, index);
    if (next.state === gameRef.current) return;
    lastFlip.current = index;
    const now = Date.now();
    if (next.comparedSymbols === null) {
      if (telemetry.current) telemetry.current = recordFirstFlip(telemetry.current, now);
      updateGame(next.state);
      return;
    }

    if (!telemetry.current) return;
    const updatedTelemetry = recordComparison(
      telemetry.current,
      next.comparedSymbols,
      next.isMatch === true,
      now
    );
    const nextCoach = coachAnswer(coachRef.current, next.isMatch === true);
    telemetry.current = nextCoach.hintLevel > coachRef.current.hintLevel ? recordHint(updatedTelemetry) : updatedTelemetry;
    updateCoach(nextCoach);
    updateGame(next.state);
    setFeedbackCue(next.isMatch ? 'match' : 'almost');

    if (next.state.status === 'SESSION_COMPLETE') {
      finish(updatedTelemetry);
      return;
    }
  };

  const handleHint = () => {
    if (!data.isCurrent() || gameRef.current.inputLocked || gameRef.current.firstCardIndex !== null || coachRef.current.hintLevel >= 3) return;
    const next = coachHint(coachRef.current);
    if (telemetry.current) telemetry.current = recordHint(telemetry.current);
    updateCoach(next);
  };

  const speechText = `${t(language, 'gameTitle')}. ${t(language, 'gameInstructions')} ${t(language, 'gameHintPrompt')} ${t(language, 'gameHint')}.`;

  return (
    <ScreenWrapper contentContainerStyle={styles.screen} scroll>
      <View onLayout={({ nativeEvent }) => setContentWidth(nativeEvent.layout.width)} style={styles.content}>
        <View style={styles.navigation}>
          <SmaranButton accessibilityLabel={t(language, 'activitiesBack')} label={t(language, 'activitiesBack')} onPress={leave} variant="outline" />
        </View>
        <View style={styles.heading}>
          <ThemedText accessibilityRole="header" textSize={textSize} type="screenTitle">
            {t(language, 'gameTitle')}
          </ThemedText>
          <ThemedText textSize={textSize} type="defaultSemiBold">
            {t(language, 'gameLevel', { level: String(difficulty) })}
          </ThemedText>
          <ThemedText textSize={textSize}>{t(language, 'gameInstructions')}</ThemedText>
        </View>

        {settings.voiceGuidance && game.status !== 'PREVIEW' ? <ReadScreenButton language={language} text={speechText} /> : null}
        {game.status !== 'IDLE' && <View style={styles.heading}>
          <SmaranButton label={t(language, paused ? 'gameResume' : 'gamePause')} accessibilityLabel={t(language, paused ? 'gameResume' : 'gamePause')}
            variant="outline" onPress={() => setPaused(value => !value)} />
          <SmaranButton label={t(language, 'gameRestart')} accessibilityLabel={t(language, 'gameRestart')} variant="outline" onPress={() => {
            completionStarted.current = false; telemetry.current = null;
            setPaused(false); setFeedbackCue(null); updateCoach(initialCoach); updateGame(createMemoryGame(difficulty));
          }} />
        </View>}

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
            <View accessibilityLiveRegion="polite" style={styles.progressRow}>
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
                const hinted = coach.hintLevel >= 2 && feedbackCue !== 'match' &&
                  (coach.hintLevel >= 3 ? supportPositions.includes(index) : index === supportPositions[0]);
                const shownState = hinted ? 'revealed' : card.state;
                const labelKey =
                  shownState === 'hidden' ? 'cardHidden' : shownState === 'matched' ? 'cardMatched' : 'cardRevealed';
                // Mismatched pair stays face-up and input-locked for 1400ms; flash
                // both cards with the shared wrong treatment until resolve.
                const mismatched = feedbackCue === 'almost' && game.inputLocked && card.state !== 'matched' &&
                  (index === game.firstCardIndex || index === lastFlip.current);
                return (
                  <MemoryCard
                    positionLabel={new Intl.NumberFormat(language).format(index + 1)}
                    accessibilityLabel={t(language, labelKey, {
                      position: String(index + 1),
                      symbol: t(language, symbol.labelKey),
                    })}
                    accessibilityHint={mismatched ? t(language, 'answerWrong') : undefined}
                    mismatched={mismatched}
                    disabled={paused || game.inputLocked || card.state === 'matched' || game.status !== 'PLAYING' || (coach.hintLevel >= 3 && !supportPositions.includes(index))}
                    highContrast={settings.highContrast}
                    hinted={hinted}
                    key={card.id}
                    onPress={() => handleCardPress(index)}
                    reducedMotion={settings.reducedMotion}
                    size={cardSize}
                    state={card.state}
                    symbol={symbol}
                  />
                );
              })}
            </View>
            {feedbackCue ? (
              <EncouragementBanner
                message={feedbackText}
                reducedMotionOverride={settings.reducedMotion ? true : null}
                tone={feedbackCue === 'match' ? 'success' : 'retry'}
              />
            ) : null}
            {hintText && feedbackCue !== 'match' && <ThemedText accessibilityLiveRegion="polite" textSize={textSize}>{hintText}</ThemedText>}
            {settings.voiceGuidance && (feedbackText || hintText) && <ReadScreenButton language={language} labelKey="coachHear" text={feedbackText + ' ' + (feedbackCue === 'match' ? '' : hintText)} />}
            {game.status === 'PREVIEW' && <SmaranButton label={t(language, 'recallReady')} accessibilityLabel={t(language, 'recallReady')}
              onPress={() => {
                if (!data.isCurrent() || gameRef.current.status !== 'PREVIEW') return;
                telemetry.current = createTelemetry(Date.now());
                updateGame(startPlaying(gameRef.current));
              }} />}
            {game.status === 'PLAYING' ? (
              <View style={[styles.hintPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText textSize={textSize}>{t(language, 'gameHintPrompt')}</ThemedText>
                <SmaranButton
                  accessibilityLabel={t(language, 'gameHint')}
                  disabled={game.inputLocked || game.firstCardIndex !== null || coach.hintLevel >= 3}
                  icon={<MaterialIcons accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={colors.text} name="lightbulb-outline" size={26} />}
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
