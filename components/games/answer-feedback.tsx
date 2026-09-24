import { MaterialIcons } from '@expo/vector-icons';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ThemeColors } from '@/constants/colors';
import { answerFeedbackFor, type AnswerFeedback, type SelectionState } from '@/src/games/selection-engine';

// Single shared correct/wrong presentation for every game board. Feedback is
// never color-only: a status icon plus the existing live-region text
// (coachCorrect/coachWrong/coachTogether) and the per-option accessibility
// hint carry the meaning. Colors stay soft (light surfaces, strong borders)
// for elderly-friendly contrast without visual aggression.
export function answerFeedbackStyle(feedback: AnswerFeedback, colors: ThemeColors): StyleProp<ViewStyle> {
  if (!feedback) return undefined;
  const correct = feedback === 'correct';
  return {
    borderColor: correct ? colors.success : colors.error,
    backgroundColor: correct ? colors.successSurface : colors.errorSurface,
    borderWidth: 3,
  };
}

export function AnswerFeedbackMark({ feedback, colors }: { feedback: AnswerFeedback; colors: ThemeColors }) {
  if (!feedback) return null;
  return <MaterialIcons
    accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    color={feedback === 'correct' ? colors.success : colors.error}
    name={feedback === 'correct' ? 'check-circle' : 'error-outline'}
    size={24}
  />;
}

// Convenience wrapper used by the three option-button boards.
export function choiceFeedback(choice: string, taskAnswer: string, selection: SelectionState): AnswerFeedback {
  return answerFeedbackFor(choice, taskAnswer, selection);
}
