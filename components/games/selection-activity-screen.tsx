import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { createInitialAdaptiveModel, recommendDifficulty } from '@ai/adaptive-engine';
import { extractAdaptiveFeatures } from '@ai/feature-extractor';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { SmaranCard } from '@components/ui/smaran-card';
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
import { prepareRoutine, type Routine } from '@/src/games/routine-recall';
import {
  chooseSelection, continueSelection, createSelection, finalizeSelection, hintSelection, resumeSelection,
  type SelectionState, type SelectionTask,
} from '@/src/games/selection-engine';

type SelectionActivity = Exclude<CognitiveActivityType, 'memory_match'>;
type ActivityData = {
  patientId: string; settings: PatientSettings; level: DifficultyLevel; history: readonly CognitiveSession[];
  model: AdaptiveModelState; tasks: readonly SelectionTask[]; patterns: readonly PatternChallenge[] | null; routine: Routine | null;
};
const shapeKeys = { circle: 'shapeCircle', triangle: 'shapeTriangle', square: 'shapeSquare', star: 'shapeStar' } as const satisfies Record<PatternShape, TranslationKey>;
const shapeIcons = { circle: 'circle', triangle: 'change-history', square: 'square', star: 'star' } as const;

function ShapeRow({ shapes, language, missing = false }: { shapes: readonly PatternShape[]; language: Language; missing?: boolean }) {
  const colors = useThemeColors();
  return <View style={styles.shapes}>
    {shapes.map((shape, index) => <View key={index} accessible accessibilityRole="image"
      accessibilityLabel={t(language, 'patternItem', { position: String(index + 1), total: String(shapes.length), shape: t(language, shapeKeys[shape]) })}
      style={[styles.shape, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <ThemedText type="secondary" accessible={false}>{index + 1}</ThemedText>
      <MaterialIcons name={shapeIcons[shape]} size={40} color={colors.text}
        accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    </View>)}
    {missing && <View accessible accessibilityLabel={t(language, 'patternInstructions')} style={[styles.shape, { borderColor: colors.primary }]}>
      <ThemedText type="screenTitle">?</ThemedText>
    </View>}
  </View>;
}

export function SelectionActivityScreen({ gameType }: { gameType: SelectionActivity }) {
  const router = useRouter();
  const colors = useThemeColors();
  const language = useOnboardingStore(state => state.language) ?? 'en';
  const [data, setData] = useState<ActivityData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const current = useRef<SelectionState | null>(null);
  const completed = useRef(false);
  const [finishingFailed, setFinishingFailed] = useState(false);
  const update = (value: SelectionState) => { current.current = value; setSelection(value); };

  useEffect(() => {
    let active = true;
    setFailed(false); setData(null); setSelection(null); current.current = null; completed.current = false;
    useCognitiveSessionStore.getState().clear();
    void (async () => {
      const resolution = await resolveActivePatient();
      if (!active) return;
      if (resolution.status !== 'ready') { router.replace('/onboarding/role'); return; }
      const { profile, settings } = resolution;
      const [history, stored] = await Promise.all([
        cognitiveRepository.getRecentSessions(profile.id, 5, gameType),
        cognitiveRepository.getAdaptiveModel(profile.id, gameType),
      ]);
      if (!active) return;
      const level = history[0]?.recommendedDifficulty ?? 1;
      const patterns = gameType === 'pattern_recognition' ? preparePatterns(level) : null;
      const preparedRoutine = gameType === 'routine_recall' ? prepareRoutine(level) : null;
      const tasks = patterns ?? preparedRoutine?.tasks;
      if (!tasks) throw new Error('Activity content is unavailable.');
      createSelection(tasks, 0); // Validate bundled content before offering Start.
      const store = useOnboardingStore.getState();
      store.setLanguage(settings.language);
      store.setAccessibilityPreferences({
        textSize: settings.textSize, highContrast: settings.highContrast,
        reducedMotion: settings.reducedMotion, voiceGuidance: settings.voiceGuidance,
      });
      setData({ patientId: profile.id, settings, level, history, model: stored ?? createInitialAdaptiveModel(profile.id, gameType),
        tasks, patterns, routine: preparedRoutine?.routine ?? null });
    })().catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, gameType, router]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && current.current) current.current = resumeSelection(current.current, Date.now());
    });
    return () => subscription.remove();
  }, []);

  const back = () => { useCognitiveSessionStore.getState().clear(); router.dismissTo('/patient/games'); };
  const title = t(language, activityTitleKeys[gameType]);
  const instructions = t(language, gameType === 'pattern_recognition' ? 'patternInstructions' : 'routineInstructions');
  const task = data?.tasks[selection?.position ?? 0];
  const pattern = data?.patterns?.[selection?.position ?? 0];
  const optionText = (choice: string) => data?.routine
    ? data.routine.steps.find(step => step.id === choice)?.text ?? ''
    : t(language, shapeKeys[choice as PatternShape]);
  const finishOrContinue = () => {
    const state = current.current;
    if (!state || !data || completed.current) return;
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

  return <ScreenWrapper scroll><View style={styles.content}>
    <SmaranButton accessibilityLabel={t(language, 'activitiesBack')} label={t(language, 'activitiesBack')} onPress={back} variant="outline" />
    <ThemedText accessibilityRole="header" type="screenTitle">{title}</ThemedText>
    {!data ? <>
      {failed ? <ThemedText accessibilityRole="alert">{t(language, 'activityPrepareFailed')}</ThemedText> : <SmaranLoading label={t(language, 'gameLoading')} />}
      {failed && <SmaranButton accessibilityLabel={t(language, 'retry')} label={t(language, 'retry')} onPress={() => setAttempt(value => value + 1)} />}
    </> : <>
      <View style={styles.group}>
        <ThemedText type="secondary">{t(language, 'gameLevel', { level: String(data.level) })}</ThemedText>
        <ThemedText>{instructions}</ThemedText>
      </View>
      {data.settings.voiceGuidance && <ReadScreenButton language={language} labelKey="activityHear" text={title + '. ' + instructions} />}
      {data.routine && <>
        {language !== 'en' && <ThemedText type="secondary">{t(language, 'routineEnglish')}</ThemedText>}
        <ThemedText accessibilityLanguage="en" type="cardHeading">{data.routine.title}</ThemedText>
      </>}
      {!selection ? <>
        {data.routine && <SmaranCard style={styles.group}>
          <ThemedText>{t(language, 'routinePreview')}</ThemedText>
          {data.routine.steps.map((step, index) => <ThemedText key={step.id} accessibilityLanguage="en">{index + 1}. {step.text}</ThemedText>)}
          {data.settings.voiceGuidance && <ReadScreenButton language={language} speechLanguage="en" labelKey="routineHear"
            text={data.routine.steps.map((step, index) => (index + 1) + '. ' + step.text).join(' ')} />}
        </SmaranCard>}
        <SmaranButton testID="activity-start" size="large" label={t(language, 'gameStart')} accessibilityLabel={t(language, 'gameStart')}
          onPress={() => { if (!current.current) update(createSelection(data.tasks, Date.now())); }} />
      </> : <>
        <ThemedText accessibilityLiveRegion="polite" type="action">{t(language, 'activityProgress', { current: String(selection.correctSelections), total: String(data.tasks.length) })}</ThemedText>
        {pattern && <View style={styles.group}>
          <ThemedText>{t(language, 'patternRepeat')}</ThemedText>
          <ShapeRow shapes={pattern.group} language={language} />
          <ShapeRow shapes={pattern.sequence} language={language} missing />
        </View>}
        {data.routine && <ThemedText accessibilityRole="header" type="cardHeading">{t(language, selection.position === 0 ? 'routineFirst' : 'routineNext')}</ThemedText>}
        <View style={styles.group}>
          {task?.choices.map(choice => <SmaranButton key={choice} testID={'choice-' + choice} size="large"
            label={optionText(choice)}
            accessibilityLabel={t(language, data.routine ? 'routineOption' : 'patternOption', { step: optionText(choice), shape: optionText(choice) })}
            disabled={selection.awaitingContinue} variant="outline"
            icon={!data.routine ? <MaterialIcons name={shapeIcons[choice as PatternShape]} size={32} color={colors.text}
              accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : undefined}
            onPress={() => { if (current.current) update(chooseSelection(current.current, data.tasks, choice, Date.now())); }} />)}
        </View>
        {selection.feedback && <ThemedText accessibilityLiveRegion="polite" type="cardHeading">
          {t(language, selection.feedback === 'correct' ? 'selectionNice' : 'selectionRetry')}
        </ThemedText>}
        {selection.hintShown && task && <SmaranCard>
          <ThemedText accessibilityLiveRegion="polite">{t(language, data.routine ? 'routineHint' : 'patternHint', { step: optionText(task.answer), shape: optionText(task.answer) })}</ThemedText>
        </SmaranCard>}
        {selection.awaitingContinue ? <SmaranButton testID="activity-continue" label={t(language, 'activityContinue')} accessibilityLabel={t(language, 'activityContinue')} onPress={finishOrContinue} /> :
          <SmaranButton testID="activity-hint" variant="outline" label={t(language, 'gameHint')} accessibilityLabel={t(language, 'gameHint')}
            disabled={selection.hintShown} onPress={() => { if (current.current) update(hintSelection(current.current)); }} />}
        {finishingFailed && <ThemedText accessibilityRole="alert">{t(language, 'activityPrepareFailed')}</ThemedText>}
      </>}
    </>}
  </View></ScreenWrapper>;
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 680, gap: Spacing.lg },
  group: { gap: Spacing.md },
  shapes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  shape: { minWidth: 64, minHeight: 80, borderWidth: 2, borderRadius: 12, padding: Spacing.xs, alignItems: 'center', justifyContent: 'center' },
});
