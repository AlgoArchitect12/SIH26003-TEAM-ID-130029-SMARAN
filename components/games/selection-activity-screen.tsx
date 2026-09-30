import { capturePatientRequest } from '@/src/stores/patient-session.store';
import { useGameTransition } from '@/hooks/use-game-transition';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { createInitialAdaptiveModel, recommendDifficulty } from '@ai/adaptive-engine';
import { extractAdaptiveFeatures } from '@ai/feature-extractor';
import { coachHintKey } from '@ai/cognitive-coach';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { SmaranCard } from '@components/ui/smaran-card';
import { ProgressIndicator } from '@components/ui/progress-indicator';
import { Spacing } from '@constants/layout';
import { cognitiveRepository } from '@db/repositories/cognitive.repository';
import type { AdaptiveModelState, CognitiveActivityType, CognitiveSession, DifficultyLevel, Language, PatientSettings } from '@db/schema.types';
import { t, type TranslationKey } from '@i18n/index';
import { resolveActivePatient } from '@services/active-patient.service';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useCognitiveSessionStore } from '@/src/stores/cognitive-session.store';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { activityTitleKeys } from '@/src/games/presentation';
import { preparePatterns, type PatternChallenge, type PatternShape } from '@/src/games/pattern-recognition';
import { prepareRoutine, routineStepText, type Routine } from '@/src/games/routine-recall';
import { prepareFamiliarObjects, prepareSequence, preparePictures, type ObjectTask, type RecallActivity } from '@/src/games/recall-activities';
import { getMemorySymbol } from '@/src/games/memory-match/assets';
import { prepareGridActivity, type GridActivity } from '@/src/games/grid-activities';
import { GridActivityBoard } from '@components/games/grid-activity-board';
import { PuzzleActivityBoard, type PuzzleActivity } from '@components/games/puzzle-activity-board';
import { prepareSudoku } from '@/src/games/sudoku-lite';
import { prepareChess } from '@/src/games/chess-puzzle';
import { prepareWords } from '@/src/games/word-match';
import type { MemorySymbolId } from '@/src/games/memory-match/types';
import {
  chooseSelection, continueSelection, createSelection, finalizeSelection, hintSelection, resumeSelection,
  type SelectionState, type SelectionTask,
} from '@/src/games/selection-engine';
import { AnswerFeedbackMark, answerFeedbackStyle, choiceFeedback } from '@components/games/answer-feedback';

type SelectionActivity = Exclude<CognitiveActivityType, 'memory_match'>;
type ActivityData = {
  patientId: string; settings: PatientSettings; level: DifficultyLevel; history: readonly CognitiveSession[];
  model: AdaptiveModelState; tasks: readonly SelectionTask[]; patterns: readonly PatternChallenge[] | null; routine: Routine | null;
  objects: readonly ObjectTask[] | null; recall: RecallActivity | null; grid: GridActivity | null; puzzle: PuzzleActivity | null; isCurrent: () => boolean;
};
const shapeKeys = { circle: 'shapeCircle', triangle: 'shapeTriangle', square: 'shapeSquare', star: 'shapeStar' } as const satisfies Record<PatternShape, TranslationKey>;
const shapeIcons = { circle: 'circle', triangle: 'change-history', square: 'square', star: 'star' } as const;

const instructionKeys = {
  pattern_recognition: 'patternInstructions', routine_recall: 'routineInstructions',
  familiar_object: 'familiarInstructions', sequence_memory: 'sequenceInstructions', picture_recall: 'pictureInstructions',
  remember_lights: 'lightsInstructions', number_path: 'numberInstructions',
  sudoku_lite: 'sudokuInstructions', chess_puzzle: 'chessInstructions', word_match: 'wordInstructions',
} as const satisfies Record<SelectionActivity, TranslationKey>;

function ShapeRow({ shapes, language }: { shapes: readonly (PatternShape | null)[]; language: Language }) {
  const colors = useThemeColors();
  return <View style={styles.shapes}>
    {shapes.map((shape, index) => <View key={index} accessible accessibilityRole="image"
      accessibilityLabel={shape === null ? t(language, 'patternGap', { position: String(index + 1) }) : t(language, 'patternItem', { position: String(index + 1), total: String(shapes.length), shape: t(language, shapeKeys[shape]) })}
      style={[styles.shape, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <ThemedText type="secondary" accessible={false}>{index + 1}</ThemedText>
      {shape === null ? <ThemedText type="screenTitle" accessible={false}>?</ThemedText> : <MaterialIcons name={shapeIcons[shape]} size={40} color={colors.text}
        accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
    </View>)}
  </View>;
}

function PictureRow({ pictures, language, ordered }: { pictures: readonly MemorySymbolId[]; language: Language; ordered: boolean }) {
  const colors = useThemeColors();
  return <View style={styles.shapes}>{pictures.map((id, index) => {
    const symbol = getMemorySymbol(id), label = t(language, symbol.labelKey);
    return <View key={index} accessible accessibilityRole="image" style={[styles.picture, { borderColor: colors.border, backgroundColor: colors.surface }]}
      accessibilityLabel={ordered ? t(language, 'recallItem', { position: String(index + 1), total: String(pictures.length), picture: label }) : label}>
      {ordered && <ThemedText accessible={false} type="secondary">{index + 1}</ThemedText>}
      <MaterialIcons name={symbol.icon} size={48} color={colors.text} accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <ThemedText accessible={false}>{label}</ThemedText>
    </View>;
  })}</View>;
}

export function SelectionActivityScreen({ gameType }: { gameType: SelectionActivity }) {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const colors = useThemeColors();
  const language = useOnboardingStore(state => state.language) ?? 'en';
  const [data, setData] = useState<ActivityData | null>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [sequencePreviewIndex, setSequencePreviewIndex] = useState(0);
  const current = useRef<SelectionState | null>(null);
  const completed = useRef(false);
  const [finishingFailed, setFinishingFailed] = useState(false);
  const update = (value: SelectionState) => { current.current = value; setSelection(value); };

  useEffect(() => {
    let active = true;
    const isCurrent = capturePatientRequest();
    setPaused(false); setSequencePreviewIndex(0); setFinishingFailed(false);
    setFailed(false); setData(null); setSelection(null); current.current = null; completed.current = false;
    useCognitiveSessionStore.getState().clear();
    void (async () => {
      const resolution = await resolveActivePatient();
      if (!active || !isCurrent()) return;
      if (resolution.status !== 'ready') { router.replace('/onboarding/role'); return; }
      const { profile, settings } = resolution;
      const [history, stored] = await Promise.all([
        cognitiveRepository.getRecentSessions(profile.id, 5, gameType),
        cognitiveRepository.getAdaptiveModel(profile.id, gameType),
      ]);
      if (!active || !isCurrent()) return;
      const level = history[0]?.recommendedDifficulty ?? 1;
      const patterns = gameType === 'pattern_recognition' ? preparePatterns(level) : null;
      const preparedRoutine = gameType === 'routine_recall' ? prepareRoutine(level, settings.language) : null;
      const objects = gameType === 'familiar_object' ? prepareFamiliarObjects(level) : null;
      const recall = gameType === 'sequence_memory' ? prepareSequence(level) : gameType === 'picture_recall' ? preparePictures(level) : null;
      const grid = gameType === 'remember_lights' || gameType === 'number_path' ? prepareGridActivity(gameType, level) : null;
      let puzzle: PuzzleActivity | null = null;
      if (gameType === 'sudoku_lite') { const sudoku = prepareSudoku(level); puzzle = { gameType, sudoku, tasks: sudoku.tasks }; }
      if (gameType === 'chess_puzzle') { const chess = prepareChess(level); puzzle = { gameType, chess, tasks: chess }; }
      if (gameType === 'word_match') { const words = prepareWords(level, settings.region); puzzle = { gameType, words, tasks: words.tasks }; }
      const tasks = patterns ?? preparedRoutine?.tasks ?? objects ?? recall?.tasks ?? grid?.tasks ?? puzzle?.tasks;
      if (!tasks) throw new Error('Activity content is unavailable.');
      createSelection(tasks, 0); // Validate bundled content before offering Start.
      const store = useOnboardingStore.getState();
      store.setLanguage(settings.language);
      store.setAccessibilityPreferences({
        textSize: settings.textSize, highContrast: settings.highContrast,
        reducedMotion: settings.reducedMotion, voiceGuidance: settings.voiceGuidance,
      });
      setData({ patientId: profile.id, settings, level, history, model: stored ?? createInitialAdaptiveModel(profile.id, gameType),
        tasks, patterns, routine: preparedRoutine?.routine ?? null, objects, recall, grid, puzzle, isCurrent: () => active && isCurrent() });
      if (auto === '1' && !recall && !preparedRoutine && !grid) {
        const state = createSelection(tasks, Date.now()); current.current = state; setSelection(state);
      }
    })().catch(() => { if (active && isCurrent()) setFailed(true); });
    return () => { active = false; };
  }, [auto, attempt, gameType, router]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && current.current) current.current = resumeSelection(current.current, Date.now());
    });
    return () => subscription.remove();
  }, []);

  const back = () => { useCognitiveSessionStore.getState().clear(); router.dismissTo('/patient/games'); };
  const title = t(language, activityTitleKeys[gameType]);
  const instructions = t(language, gameType === 'pattern_recognition' && data?.level === 1 ? 'patternMatch'
    : gameType === 'pattern_recognition' && data && data.level >= 4 ? 'patternMissing' : instructionKeys[gameType]);
  const task = data?.tasks[selection?.position ?? 0];
  const pattern = data?.patterns?.[selection?.position ?? 0];
  const object = data?.objects?.[selection?.position ?? 0];
  const optionText = (choice: string) => data?.routine
    ? routineStepText(choice, language)
    : data?.grid || data?.puzzle ? choice : data?.patterns ? t(language, shapeKeys[choice as PatternShape]) : t(language, getMemorySymbol(choice as MemorySymbolId).labelKey);
  const position = pattern ? (pattern.missingIndex ?? (pattern.kind === 'match' ? 0 : pattern.sequence.length)) + 1 : (selection?.position ?? 0) + 1;
  const prompt = object ? t(language, data && data.level <= 2 ? 'familiarFind' : object.cue, { answer: optionText(object.answer) })
    : gameType === 'sequence_memory' ? t(language, 'sequenceQuestion', { position: String(position) })
      : gameType === 'picture_recall' ? t(language, 'pictureQuestion')
        : data?.routine ? t(language, selection?.position ? 'routineNext' : 'routineFirst') : instructions;
  const hintKey = selection ? coachHintKey(gameType, selection) : null;
  const hintText = hintKey && task ? t(language, hintKey, { answer: optionText(task.answer), position: String(position) }) : '';
  const feedbackText = selection?.feedback ? t(language, selection.feedback === 'correct' ? 'coachCorrect' : selection.wrongAnswers === 1 ? 'coachWrong' : 'coachTogether') : '';
  const finishOrContinue = () => {
    const state = current.current;
    if (!state || !data || !data.isCurrent() || completed.current) return;
    if (state.completedAtMs === null) { update(continueSelection(state, Date.now())); return; }
    try {
      completed.current = true; setFinishingFailed(false);
      const telemetry = finalizeSelection(state, gameType);
      const extraction = extractAdaptiveFeatures({ patientId: data.patientId, currentDifficulty: data.level, recentSessions: data.history, telemetry });
      useCognitiveSessionStore.getState().setPending({
        patientId: data.patientId, currentDifficulty: data.level, model: data.model, telemetry, extraction,
        initialRecommendation: recommendDifficulty(data.level, extraction.features, data.model),
      });
      router.replace('/patient/games/result');
    } catch {
      completed.current = false; setFinishingFailed(true);
    }
  };

  useGameTransition(selection?.awaitingContinue && !data?.puzzle ? 1400 : null, finishOrContinue, paused);

  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton accessibilityLabel={t(language, 'activitiesBack')} label={t(language, 'activitiesBack')} onPress={back} variant="outline" />
    <ThemedText accessibilityRole="header" type="screenTitle">{title}</ThemedText>
    {!data ? <>
      {failed ? <ThemedText accessibilityRole="alert">{t(language, 'activityPrepareFailed')}</ThemedText> : <SmaranLoading label={t(language, 'gameLoading')} />}
      {failed && <SmaranButton accessibilityLabel={t(language, 'retry')} label={t(language, 'retry')} onPress={() => setAttempt(value => value + 1)} />}
    </> : <>
      {selection && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <SmaranButton style={{ flexGrow: 1, flexBasis: 140 }} label={t(language, paused ? 'gameResume' : 'gamePause')} accessibilityLabel={t(language, paused ? 'gameResume' : 'gamePause')} variant="outline" onPress={() => setPaused(value => !value)} />
        <SmaranButton style={{ flexGrow: 1, flexBasis: 140 }} label={t(language, 'gameRestart')} accessibilityLabel={t(language, 'gameRestart')} variant="outline" onPress={() => setAttempt(value => value + 1)} />
      </View>}
      <SmaranCard style={styles.group}>
        <ThemedText type="secondary">{t(language, 'gameLevel', { level: String(data.level) })}</ThemedText>
        <ThemedText>{instructions}</ThemedText>
      </SmaranCard>
      {data.settings.voiceGuidance && !selection && <ReadScreenButton language={language} labelKey="activityHear" text={title + '. ' + instructions} />}
      {data.routine && <>
        <ThemedText accessibilityLanguage={language} type="cardHeading">{data.routine.title}</ThemedText>
      </>}
      {!selection ? <>
        {data.routine && <SmaranCard style={styles.group}>
          <ThemedText>{t(language, 'routinePreview')}</ThemedText>
          {data.routine.steps.map((step, index) => <ThemedText key={step.id} accessibilityLanguage={language}>{index + 1}. {step.text}</ThemedText>)}
          {data.settings.voiceGuidance && <ReadScreenButton language={language} labelKey="routineHear"
            text={data.routine.steps.map((step, index) => (index + 1) + '. ' + step.text).join(' ')} />}
        </SmaranCard>}
        {data.recall && <SmaranCard style={styles.group}>
          <ThemedText>{t(language, gameType === 'sequence_memory' ? 'sequencePreview' : 'picturePreview')}</ThemedText>
          {gameType === 'sequence_memory' ? (
            <PictureRow pictures={[data.recall.preview[sequencePreviewIndex]]} language={language} ordered={false} />
          ) : (
            <PictureRow pictures={data.recall.preview} language={language} ordered={false} />
          )}
          {data.settings.voiceGuidance && <ReadScreenButton language={language} text={data.recall.preview.map((id, index) =>
            gameType === 'picture_recall' ? optionText(id) : t(language, 'recallItem', { position: String(index + 1), total: String(data.recall?.preview.length), picture: optionText(id) })).join(' ')} />}
        </SmaranCard>}
        {gameType === 'sequence_memory' && sequencePreviewIndex < (data.recall?.preview.length ?? 1) - 1 ? (
          <SmaranButton testID="activity-next-preview" size="large" label={t(language, 'continue')} accessibilityLabel={t(language, 'continue')}
            onPress={() => setSequencePreviewIndex(value => value + 1)} />
        ) : (
          <SmaranButton testID="activity-start" size="large" label={t(language, data.recall ? 'recallReady' : 'gameStart')} accessibilityLabel={t(language, data.recall ? 'recallReady' : 'gameStart')}
            onPress={() => { if (data.isCurrent() && !current.current) update(createSelection(data.tasks, Date.now())); }} />
        )}
      </> : <>
        <ProgressIndicator current={selection.correctSelections} total={data.tasks.length}
          label={t(language, 'activityProgress', { current: String(selection.correctSelections), total: String(data.tasks.length) })} />
        {data.puzzle ? <PuzzleActivityBoard paused={paused} activity={data.puzzle} selection={selection} level={data.level}
          language={language} voice={data.settings.voiceGuidance} isCurrent={data.isCurrent} onContinue={finishOrContinue}
          onChange={change => { if (!paused && data.isCurrent() && current.current) update(change(current.current)); }} /> : data.grid ? <GridActivityBoard paused={paused} key={Math.floor(selection.position / data.grid.roundLength)} activity={data.grid} selection={selection}
          language={language} voice={data.settings.voiceGuidance} isCurrent={data.isCurrent} onContinue={finishOrContinue}
          onChange={change => { if (!paused && data.isCurrent() && current.current) update(change(current.current)); }} /> : <>
        {pattern && <View style={styles.group}>
          {pattern.kind !== 'match' && <>
            <ThemedText>{t(language, 'patternRepeat')}</ThemedText>
            <ShapeRow shapes={pattern.group} language={language} />
          </>}
          <ShapeRow shapes={pattern.kind === 'next' ? [...pattern.sequence, null]
            : pattern.sequence.map((shape, index) => index === pattern.missingIndex ? null : shape)} language={language} />
        </View>}
        {data.routine && <ThemedText accessibilityRole="header" type="cardHeading">{t(language, selection.position === 0 ? 'routineFirst' : 'routineNext')}</ThemedText>}
        {(object || data.recall) && <ThemedText accessibilityRole="header" type="cardHeading">{prompt}</ThemedText>}
        {data.settings.voiceGuidance && !selection.awaitingContinue && <ReadScreenButton language={language} text={prompt + ' ' + (task?.choices.map(optionText).join('. ') ?? '')} />}
        <View style={styles.group}>
          {task?.choices.map(choice => {
            const feedback = selection ? choiceFeedback(choice, task.answer, selection) : null;
            return <SmaranButton key={choice} testID={'choice-' + choice} size="large"
            label={optionText(choice)}
            accessibilityLabel={t(language, data.routine ? 'routineOption' : pattern ? 'patternOption' : 'pictureOption', { step: optionText(choice), shape: optionText(choice), picture: optionText(choice) })}
            accessibilityState={feedback === 'correct' ? { selected: true } : undefined}
            disabled={paused || selection.awaitingContinue || (selection.hintLevel === 3 && choice !== task.answer)} variant="outline"
            accessibilityHint={feedback === 'wrong' ? t(language, 'answerWrong')
              : selection.hintLevel === 3 && choice === task.answer ? hintText : undefined}
            icon={!data.routine || feedback ? <>
              {!data.routine ? <MaterialIcons name={pattern ? shapeIcons[choice as PatternShape] : getMemorySymbol(choice as MemorySymbolId).icon} size={36} color={colors.text}
                accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : null}
              <AnswerFeedbackMark feedback={feedback} colors={colors} />
            </> : undefined}
            style={answerFeedbackStyle(feedback, colors)}
            onPress={() => { if (data.isCurrent() && current.current) update(chooseSelection(current.current, data.tasks, choice, Date.now())); }} />;
          })}
        </View>
        {selection.feedback && <ThemedText accessibilityLiveRegion="polite" type="cardHeading">
          {feedbackText}
        </ThemedText>}
        {hintText && !selection.awaitingContinue && <SmaranCard style={[styles.group, { backgroundColor: colors.warningSurface, borderColor: colors.warning }]}>
          <ThemedText accessibilityLiveRegion="polite">{hintText}</ThemedText>
          {selection.hintLevel === 2 && data.recall && <PictureRow pictures={data.recall.preview} language={language} ordered={gameType === 'sequence_memory'} />}
          {selection.hintLevel === 2 && object && <PictureRow pictures={[object.answer]} language={language} ordered={false} />}
          {selection.hintLevel === 2 && data.routine && data.routine.steps.map((step, index) =>
            <ThemedText key={step.id} accessibilityLanguage={language}>{index + 1}. {step.text}</ThemedText>)}
        </SmaranCard>}
        {data.settings.voiceGuidance && (feedbackText || hintText) && <ReadScreenButton language={language} labelKey="coachHear" text={feedbackText + ' ' + (selection.awaitingContinue ? '' : hintText)} />}
        {!selection.awaitingContinue &&
          <SmaranButton testID="activity-hint" variant="outline" label={t(language, 'gameHint')} accessibilityLabel={t(language, 'gameHint')}
            disabled={paused || selection.hintLevel === 3} onPress={() => { if (!paused && data.isCurrent() && current.current) update(hintSelection(current.current)); }} />}
        </>}
        {finishingFailed && <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={finishOrContinue} />}
      </>}
    </>}
  </View></ScreenWrapper>;
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 680, gap: Spacing.lg },
  group: { gap: Spacing.md },
  shapes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  shape: { minWidth: 64, minHeight: 80, borderWidth: 2, borderRadius: 12, padding: Spacing.xs, alignItems: 'center', justifyContent: 'center' },
  picture: { flexBasis: 120, flexGrow: 1, maxWidth: '100%', minHeight: 112, borderWidth: 2, borderRadius: 12, padding: Spacing.sm, gap: Spacing.xs, alignItems: 'center', justifyContent: 'center' },
});
