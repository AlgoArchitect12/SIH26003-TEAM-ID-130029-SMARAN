import { useIsFocused } from '@react-navigation/native';
import { useGameTransition } from '@/hooks/use-game-transition';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/use-theme-color';
import { initialCoach, type CoachState } from '@ai/cognitive-coach';
import { ReadScreenButton } from '@components/accessibility/read-screen-button';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { Layout, Spacing } from '@constants/layout';
import type { DifficultyLevel, Language } from '@db/schema.types';
import { t } from '@i18n/index';
import { chessSymbols, isLegalChessMove, movementKeys, moveChessPiece, pieceKeys, type ChessPiece, type ChessTask } from '@/src/games/chess-puzzle';
import { sudokuCandidates, sudokuPeers, type SudokuPuzzle } from '@/src/games/sudoku-lite';
import type { WordActivity } from '@/src/games/word-match';
import { chooseSelection, continueSelection, hintSelection, resumeSelection, type SelectionState, type SelectionTask } from '@/src/games/selection-engine';
import { AnswerFeedbackMark, answerFeedbackStyle, choiceFeedback } from '@components/games/answer-feedback';

export type PuzzleActivity = { tasks: readonly SelectionTask[] } & (
  { gameType: 'sudoku_lite'; sudoku: SudokuPuzzle } |
  { gameType: 'chess_puzzle'; chess: readonly ChessTask[] } |
  { gameType: 'word_match'; words: WordActivity }
);
type Props = {
  paused?: boolean;
  activity: PuzzleActivity; selection: SelectionState; level: DifficultyLevel; language: Language; voice: boolean;
  isCurrent: () => boolean; onChange: (change: (state: SelectionState) => SelectionState) => void; onContinue: () => void;
};

export function PuzzleActivityBoard({ paused = false, activity, selection, level, language, voice, isCurrent, onChange, onContinue }: Props) {
  const colors = useThemeColors(), focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const order = useRef([...activity.tasks]);
  const coaches = useRef<Record<string, CoachState>>({});
  const alive = useRef(true);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const latest = useRef({ focused, isCurrent, onChange });
  latest.current = { focused, isCurrent, onChange };
  const canAct = () => alive.current && foreground.current && latest.current.focused && latest.current.isCurrent();
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (canAct()) latest.current.onChange(value => resumeSelection(value, Date.now()));
    });
    return () => { alive.current = false; subscription.remove(); };
    // This board lives for one prepared session. Callbacks are read through latest.
  }, []);
  useEffect(() => {
    if (focused && isCurrent()) onChange(value => resumeSelection(value, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const task = order.current[selection.position];
  const done = new Set(order.current.slice(0, selection.correctSelections).map(item => item.id));
  const locked = paused || selection.awaitingContinue || !focused;
  const focusTask = (id: string) => {
    if (!canAct()) return;
    onChange(state => {
      const index = order.current.findIndex(item => item.id === id);
      if (state.awaitingContinue || state.completedAtMs !== null || index <= state.position) return state;
      const current = order.current[state.position];
      coaches.current[current.id] = { hintLevel: state.hintLevel, wrongAnswers: state.wrongAnswers };
      [order.current[state.position], order.current[index]] = [order.current[index], current];
      return { ...state, ...(coaches.current[id] ?? initialCoach), feedback: null, lastChoice: null };
    });
  };
  const pick = (choice: string) => {
    if (canAct()) onChange(state => chooseSelection(state, order.current, choice, Date.now()));
  };
  const hint = () => { if (canAct()) onChange(hintSelection); };
  const sudoku = activity.gameType === 'sudoku_lite' ? activity.sudoku : null;
  const chess = activity.gameType === 'chess_puzzle' ? activity.chess[selection.position] : null;
  const words = activity.gameType === 'word_match' ? activity.words : null;
  const cell = Number(task.id);
  const row = sudoku ? Math.floor(cell / sudoku.size) + 1 : 0, column = sudoku ? cell % sudoku.size + 1 : 0;
  const cellLabel = (i: number) => t(language, 'sudokuCell', { row: String(Math.floor(i / sudoku!.size) + 1), column: String(i % sudoku!.size + 1) });
  const values = sudoku?.clues.map((n, i) => n || (done.has(String(i)) ? sudoku.solution[i] : 0));
  const pair = words?.pairs.find(item => item.id === task.id);
  const choiceText = (choice: string) => words ? t(language, words.options.find(item => item.id === choice)!.right)
    : chess?.kind === 'recognize' ? t(language, pieceKeys[choice as ChessPiece])
      : chess ? t(language, 'chessSquare', { square: choice, piece: chess.board[choice]
        ? t(language, chess.board[choice].side === 'white' ? 'chessWhite' : 'chessBlack') + ' ' + t(language, pieceKeys[chess.board[choice].kind])
        : t(language, 'chessEmpty'), mark: '' }).trim() : choice;
  const prompt = sudoku ? cellLabel(cell) + '. ' + t(language, 'sudokuChoose')
    : pair ? t(language, 'wordChoose', { word: t(language, pair.left) })
      : chess ? t(language, chess.kind === 'recognize' ? 'chessRecognize' : chess.kind === 'capture' ? 'chessCapture' : chess.kind === 'safe' ? 'chessSafe' : 'chessMove', {
        source: chess.source, piece: t(language, pieceKeys[chess.board[chess.source].kind]), target: chess.target ?? '',
      }) : '';
  const feedback = selection.feedback === 'correct' ? t(language, 'coachCorrect') : selection.feedback === 'retry'
    ? t(language, sudoku ? 'sudokuWrong' : chess ? 'chessWrong' : 'wordWrong') : '';
  const guidance = selection.awaitingContinue || !selection.hintLevel ? '' : selection.hintLevel === 3
    ? t(language, 'puzzleReveal', { answer: choiceText(task.answer) })
    : sudoku ? selection.hintLevel === 1 ? t(language, 'sudokuHint', { row: String(row), column: String(column),
      region: String(Math.floor((row - 1) / 2) * 2 + Math.floor((column - 1) / sudoku.regionWidth) + 1) })
      : t(language, 'sudokuFocus', { numbers: sudokuCandidates(values!, sudoku.size, cell).join(', ') })
      : chess ? (chess.kind === 'recognize' ? t(language, 'puzzleReveal', { answer: choiceText(task.answer) })
        : t(language, movementKeys[chess.board[chess.source].kind]) + (chess.kind === 'safe' ? ' ' + t(language, 'chessSafeHint') : ''))
        : pair ? t(language, pair.hint) : '';
  const interactiveSudoku = sudoku && (width - 4) / sudoku.size >= Layout.minTouchTarget;
  const chessBoard = chess && selection.awaitingContinue && chess.kind !== 'recognize' ? moveChessPiece(chess.board, chess.source, chess.answer) : chess?.board;

  useGameTransition(selection.awaitingContinue ? 1400 : null, () => {
    if (!canAct()) return;
    if (selection.completedAtMs !== null) { onContinue(); return; }
    onChange(state => {
      const next = continueSelection(state, Date.now());
      return next === state ? state : { ...next, ...(coaches.current[order.current[next.position].id] ?? initialCoach) };
    });
  }, paused);

  return <View style={styles.group} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <ThemedText accessibilityLiveRegion="polite" type="cardHeading">{prompt}</ThemedText>
    {sudoku && values && <>
      <View testID="sudoku-board" style={[styles.board, { borderColor: colors.text }]}>
        {Array.from({ length: sudoku.size }, (_, r) => <View key={r} style={styles.row}>
          {values.slice(r * sudoku.size, (r + 1) * sudoku.size).map((n, c) => {
            const i = r * sudoku.size + c, selected = i === cell, fixed = sudoku.clues[i] !== 0;
            const guided = selected || ((level === 1 || selection.hintLevel > 0) && sudokuPeers(sudoku.size, cell, i));
            const label = cellLabel(i) + '. ' + (n || t(language, 'chessEmpty')) + '. ' +
              (fixed ? t(language, 'sudokuFixed') : done.has(String(i)) ? t(language, 'sudokuFilled') : t(language, 'sudokuChoose'));
            return <Pressable key={i} testID={'sudoku-cell-' + i} accessible accessibilityLabel={label}
              accessibilityRole={interactiveSudoku && !fixed && !n ? 'button' : 'text'}
              accessibilityState={{ selected, disabled: !interactiveSudoku || locked || !!n }}
              disabled={!interactiveSudoku || locked || !!n} onPress={() => focusTask(String(i))}
              style={[styles.cell, { minHeight: Layout.minTouchTarget, borderColor: colors.text,
                borderRightWidth: c === sudoku.regionWidth - 1 ? 3 : 1, borderBottomWidth: r % 2 === 1 ? 3 : 1,
                backgroundColor: guided ? colors.surfaceSelected : colors.surface }, selected && styles.selected]}>
              <ThemedText accessible={false} style={{ fontWeight: fixed ? '700' : '400' }}>{n || (selected ? '□' : '·')}</ThemedText>
            </Pressable>;
          })}
        </View>)}
      </View>
      {!interactiveSudoku && <>
        <ThemedText type="secondary">{t(language, 'boardChoices')}</ThemedText>
        {activity.tasks.filter(item => !done.has(item.id)).map(item => <SmaranButton key={item.id} testID={'sudoku-focus-' + item.id}
          label={(item.id === task.id ? '□ ' : '') + cellLabel(Number(item.id))} accessibilityLabel={cellLabel(Number(item.id))}
          accessibilityState={{ selected: item.id === task.id }} disabled={locked} variant="outline" onPress={() => focusTask(item.id)} />)}
      </>}
    </>}
    {chess && chessBoard && <>
      <ThemedText accessibilityLiveRegion="polite">{chess.kind === 'recognize' ? t(language, 'chessChoosePiece') : t(language, 'chessSelectSource', {
        piece: t(language, pieceKeys[chess.board[chess.source].kind]), square: chess.source,
      })}</ThemedText>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View testID="chess-board" style={[styles.board, { width: Math.max(width, 8 * Layout.minTouchTarget), borderColor: colors.text }]}>
        {Array.from({ length: 8 }, (_, r) => <View key={r} style={styles.row}>
          {Array.from({ length: 8 }, (_, c) => {
            const s = String.fromCharCode(97 + c) + (8 - r), piece = chessBoard[s];
            const source = s === chess.source, target = s === chess.target;
            const legalHint = selection.hintLevel >= 2 && chess.choices.includes(s) && isLegalChessMove(chess.board, chess.source, s);
            const marked = source || target || legalHint;
            const label = t(language, 'chessSquare', { square: s, piece: piece ? t(language, piece.side === 'white' ? 'chessWhite' : 'chessBlack') + ' ' + t(language, pieceKeys[piece.kind]) : t(language, 'chessEmpty'),
              mark: source ? t(language, 'chessSource') : target ? t(language, 'chessTarget') : legalHint ? t(language, 'chessLegal') : '' });
            const playable = chess.kind !== 'recognize' && chess.choices.includes(s);
            return <Pressable key={s} accessible accessibilityRole={playable ? 'button' : 'image'} accessibilityLabel={label}
              accessibilityState={{ selected: source, disabled: playable && locked }} disabled={!playable || locked}
              onPress={() => pick(s)}
              style={[styles.chessCell, { backgroundColor: (r + c) % 2 ? colors.text : colors.surface, borderColor: colors.accent }, marked && styles.selected]}>
              <Text accessible={false} allowFontScaling={false} style={{ fontSize: Math.min(32, Math.max(18, width / 8 * 0.55)), color: (r + c) % 2 ? colors.surface : colors.text }}>
                {piece ? chessSymbols[piece.side][piece.kind] : marked ? '◇' : ' '}
              </Text>
              <Text accessible={false} allowFontScaling={false} style={{ fontSize: 10, color: (r + c) % 2 ? colors.surface : colors.text }}>{s}</Text>
            </Pressable>;
          })}
        </View>)}
      </View>
      </ScrollView>
      <ThemedText type="secondary">{t(language, 'boardChoices')} {t(language, chess.kind === 'recognize' ? 'chessChoosePiece' : 'chessChooseSquare')}</ThemedText>
    </>}
    {words && <View style={styles.group}>
      {words.pairs.map(item => <SmaranButton key={item.id} testID={'word-focus-' + item.id} variant="outline"
        label={(done.has(item.id) ? '✓ ' : '') + t(language, item.left)} accessibilityLabel={t(language, item.left) + (done.has(item.id) ? '. ' + t(language, 'activityFinished') : '')}
        accessibilityState={{ selected: task.id === item.id }} disabled={locked || done.has(item.id)} onPress={() => focusTask(item.id)} />)}
    </View>}
    {voice && <ReadScreenButton language={language} text={prompt + '. ' + task.choices.map(choiceText).join('. ')} />}
    {words && <ThemedText type="cardHeading">{prompt}</ThemedText>}
    <View style={styles.group}>
      {task.choices.map(choice => {
        const feedback = choiceFeedback(choice, task.answer, selection);
        return <SmaranButton key={choice} testID={'puzzle-choice-' + choice} size="large" variant="outline"
          label={(selection.hintLevel >= 2 && choice === task.answer ? '◇ ' : '') + choiceText(choice)} accessibilityLabel={choiceText(choice)}
          accessibilityState={feedback === 'correct' ? { selected: true } : undefined}
          accessibilityHint={feedback === 'wrong' ? t(language, 'answerWrong') : undefined}
          icon={feedback === 'wrong' ? <AnswerFeedbackMark feedback={feedback} colors={colors} /> : undefined}
          style={answerFeedbackStyle(feedback, colors)}
          disabled={locked || (words !== null && done.has(choice)) || (selection.hintLevel === 3 && choice !== task.answer)}
          onPress={() => pick(choice)} />;
      })}
    </View>
    {!!feedback && <ThemedText type="cardHeading" accessibilityLiveRegion="polite">{feedback}</ThemedText>}
    {!!guidance && <ThemedText accessibilityLiveRegion="polite">{guidance}</ThemedText>}
    {voice && !!(feedback || guidance) && <ReadScreenButton language={language} labelKey="coachHear" text={feedback + ' ' + guidance} />}
    {!selection.awaitingContinue && <SmaranButton testID="activity-hint" variant="outline" label={t(language, 'gameHint')} accessibilityLabel={t(language, 'gameHint')}
      disabled={selection.hintLevel === 3} onPress={hint} />}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: Spacing.md },
  board: { borderWidth: 2, width: '100%' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingVertical: Spacing.sm },
  chessCell: { flex: 1, minWidth: 0, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  selected: { borderWidth: 3, borderStyle: 'dashed' },
});
