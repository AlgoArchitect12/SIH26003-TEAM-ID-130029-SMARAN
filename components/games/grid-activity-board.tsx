import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useThemeColors } from '@/hooks/use-theme-color';
import { coachHintKey } from '@ai/cognitive-coach';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Radius, Spacing } from '@constants/layout';
import type { Language } from '@db/schema.types';
import { t } from '@i18n/index';
import type { GridActivity } from '@/src/games/grid-activities';
import { chooseSelection, hintSelection, resumeSelection, type SelectionState } from '@/src/games/selection-engine';
import { AnswerFeedbackMark, answerFeedbackStyle, choiceFeedback } from '@components/games/answer-feedback';

type Phase = 'preview' | 'playback' | 'ready' | 'answer';
type Props = {
  paused?: boolean;
  activity: GridActivity; selection: SelectionState; language: Language; voice: boolean;
  isCurrent: () => boolean; onChange: (change: (state: SelectionState) => SelectionState) => void;
  onContinue: () => void;
};

// The parent keys this board by round. Selection metrics remain in the shared engine.
export function GridActivityBoard({ paused = false, activity, selection, language, voice, isCurrent, onChange }: Props) {
  const colors = useThemeColors(), reducedMotion = useReducedMotion(), focused = useIsFocused();
  const lights = activity.gameType === 'remember_lights';
  const [phase, setPhase] = useState<Phase>(lights ? 'preview' : 'answer');
  const phaseRef = useRef(phase);
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const [manual, setManual] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const alive = useRef(true);
  const latest = useRef({ selection, isCurrent, onChange, focused, foreground });
  latest.current = { selection, isCurrent, onChange, focused, foreground };
  const changePhase = (value: Phase) => { phaseRef.current = value; setPhase(value); };
  const changeFrame = (value: number) => { frameRef.current = value; setFrame(value); };
  const canAct = () => alive.current && latest.current.isCurrent() && latest.current.focused && latest.current.foreground;
  const round = Math.floor(selection.position / activity.roundLength);
  const preview = activity.tasks.slice(round * activity.roundLength, (round + 1) * activity.roundLength);
  const task = activity.tasks[selection.position];
  const atMyPace = manual || reducedMotion || screenReader;

  useEffect(() => {
    alive.current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (alive.current) setScreenReader(value); }).catch(() => undefined);
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const app = AppState.addEventListener('change', value => {
      latest.current.foreground = value === 'active';
      setForeground(value === 'active');
      if (value !== 'active' && phaseRef.current !== 'answer') changePhase('preview');
      if (value === 'active' && latest.current.isCurrent()) latest.current.onChange(state => resumeSelection(state, Date.now()));
    });
    return () => { alive.current = false; reader.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    if (!focused && phaseRef.current !== 'answer') changePhase('preview');
    if (focused && latest.current.isCurrent()) latest.current.onChange(state => resumeSelection(state, Date.now()));
  }, [focused]);

  useEffect(() => {
    if (paused || phase !== 'playback' || atMyPace || !focused || !foreground) return;
    // Long, steady emphasis with a quiet gap; no animation or flashing.
    const timer = setTimeout(() => {
      const current = latest.current;
      if (!alive.current || !current.isCurrent() || !current.focused || !current.foreground) return;
      if (frame + 1 >= activity.roundLength * 2) changePhase('ready');
      else changeFrame(frame + 1);
    }, frame % 2 ? 700 : selection.hintLevel ? 2400 : activity.presentationMs);
    return () => clearTimeout(timer);
  }, [paused, phase, frame, atMyPace, focused, foreground, activity.roundLength, activity.presentationMs, selection.hintLevel]);

  const replay = () => { if (canAct()) { changeFrame(0); changePhase('playback'); } };
  const requestHint = () => {
    if (!canAct() || phaseRef.current !== 'answer') return;
    onChange(state => hintSelection(state));
    if (lights) replay();
  };
  const pick = (choice: string) => {
    if (!canAct() || phaseRef.current !== 'answer') return;
    onChange(state => {
      const next = chooseSelection(state, activity.tasks, choice, Date.now());
      // The coach's first hint really replays the round, without losing correct taps.
      if (lights && next.hintLevel === 1 && state.hintLevel === 0) replay();
      return next;
    });
  };
  const activeLight = phase === 'playback' && (atMyPace || frame % 2 === 0) ? preview[Math.floor(frame / 2)]?.answer : null;
  const feedback = selection.feedback === 'correct' ? t(language, 'coachCorrect') : selection.feedback === 'retry'
    ? t(language, !lights ? 'numberWrong' : selection.wrongAnswers === 1 ? 'gridWrong' : 'gridSmallHint', { answer: task.answer }) : '';
  const hintKey = coachHintKey(activity.gameType, selection);
  const hint = !selection.awaitingContinue && hintKey ? t(language, hintKey, { answer: task.answer }) : '';
  const prompt = phase === 'playback' ? (activeLight ? t(language, 'lightsShowing', {
    position: String(Math.floor(frame / 2) + 1), total: String(activity.roundLength), number: activeLight,
  }) : t(language, 'lightsWatch')) : lights ? t(language, phase === 'answer' ? 'lightsTurn' : phase === 'ready' ? 'lightsReady' : 'lightsWatch', {
    position: String(selection.position % activity.roundLength + 1),
  }) : t(language, activity.showNext || selection.hintLevel ? 'numberNext' : 'numberTurn', { answer: task.answer });

  return <View style={styles.group}>
    <SmaranCard style={styles.group}>
    <ThemedText type="secondary">{t(language, 'gridRound', { current: String(round + 1), total: String(activity.rounds) })}</ThemedText>
    <ThemedText accessibilityLiveRegion="polite" type="cardHeading">{prompt}</ThemedText>
    {lights && phase === 'answer' && <ThemedText accessibilityLiveRegion="polite">{t(language, 'lightsProgress', {
      current: String(selection.correctSelections - round * activity.roundLength), total: String(activity.roundLength),
    })}</ThemedText>}
    </SmaranCard>
    <View style={styles.grid}>
    {(lights ? activity.tiles : task.choices).map((tile, index) => {
        const done = !lights && activity.tasks.slice(0, selection.correctSelections).some(item => item.answer === tile);
        const guided = phase === 'answer' && !selection.awaitingContinue && tile === task.answer &&
          (selection.hintLevel >= (lights ? 2 : 1) || activity.markNext);
        const emphasized = tile === activeLight || guided;
        const feedback = choiceFeedback(tile, task.answer, selection);
        const disabled = paused || phase !== 'answer' || selection.awaitingContinue || done || !focused || !foreground ||
          (selection.hintLevel === 3 && tile !== task.answer);
        return <SmaranButton key={tile} testID={'grid-tile-' + tile} size="large" label={`${tile === activeLight ? '◆ ' : done ? '✓ ' : ''}${tile}`}
          accessibilityLabel={t(language, lights ? 'lightTile' : done ? 'numberDone' : 'numberTile', {
            number: tile, row: String(Math.floor(index / 2) + 1), column: String(index % 2 + 1),
          })}
          accessibilityState={{ selected: done || tile === activeLight || feedback === 'correct' }}
          accessibilityHint={guided ? hint || prompt : feedback === 'wrong' ? t(language, 'answerWrong') : undefined}
          disabled={disabled} variant="outline" reducedMotionOverride hapticsEnabled={!reducedMotion}
          icon={feedback === 'wrong' ? <AnswerFeedbackMark feedback={feedback} colors={colors} /> : undefined}
          style={[styles.tile,
            { borderColor: colors.border, borderWidth: 2, backgroundColor: colors.surface },
            emphasized && !feedback ? { borderColor: colors.primary, borderWidth: 4, backgroundColor: colors.surfaceSelected } : null,
            !feedback && done ? { backgroundColor: colors.successSurface, borderColor: colors.success } : null,
            answerFeedbackStyle(feedback, colors),
          ]}
          textStyle={{ color: colors.text }} onPress={() => pick(tile)} />;
      })}
    </View>
    {!!feedback && <SmaranCard style={answerFeedbackStyle(selection.feedback === 'correct' ? 'correct' : 'wrong', colors)}>
      <ThemedText accessibilityLiveRegion="polite" type="cardHeading">{feedback}</ThemedText>
    </SmaranCard>}
    {!!hint && <SmaranCard style={{ backgroundColor: colors.warningSurface, borderColor: colors.warning }}>
      <ThemedText accessibilityLiveRegion="polite">{hint}</ThemedText>
    </SmaranCard>}
    {voice && phase !== 'playback' && <ReadScreenButton language={language} labelKey="coachHear" text={[prompt, feedback, hint].filter(Boolean).join(' ')} />}
    {phase === 'preview' && <>
      <SmaranButton testID="lights-manual" label={t(language, 'lightsManual')} accessibilityLabel={t(language, 'lightsManual')}
        variant="outline" accessibilityState={{ selected: atMyPace }} disabled={reducedMotion || screenReader} onPress={() => setManual(value => !value)} />
      <SmaranButton testID="lights-play" label={t(language, 'lightsWatch')} accessibilityLabel={t(language, 'lightsWatch')} onPress={replay} />
    </>}
    {phase === 'playback' && <SmaranButton testID="lights-next" label={t(language, 'lightsNext')} accessibilityLabel={t(language, 'lightsNext')}
      onPress={() => {
        if (!canAct() || phaseRef.current !== 'playback') return;
        setManual(true);
        const next = frameRef.current + 2 - frameRef.current % 2;
        if (next >= activity.roundLength * 2) changePhase('ready'); else changeFrame(next);
      }} />}
    {phase === 'ready' && <SmaranButton testID="lights-ready" label={t(language, 'lightsReady')} accessibilityLabel={t(language, 'lightsReady')}
      onPress={() => { if (!canAct() || phaseRef.current !== 'ready') return; changePhase('answer'); onChange(state => resumeSelection(state, Date.now())); }} />}
    {phase === 'answer' && !selection.awaitingContinue && <SmaranButton testID="activity-hint" variant="outline" disabled={paused || selection.hintLevel === 3}
      label={t(language, 'gameHint')} accessibilityLabel={t(language, 'gameHint')} onPress={requestHint} />}
    {lights && phase === 'answer' && selection.hintLevel > 0 && !selection.awaitingContinue && <SmaranButton testID="lights-replay" variant="outline"
      label={t(language, 'lightsReplay')} accessibilityLabel={t(language, 'lightsReplay')}
      onPress={() => { if (!canAct()) return; onChange(state => ({ ...state, hintsUsed: state.hintsUsed + 1 })); replay(); }} />}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 104, borderRadius: Radius.card, paddingHorizontal: Spacing.sm },
});
