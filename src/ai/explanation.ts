import type { TranslationKey } from '@i18n/index';
import type { CognitiveActivityType } from '../db/schema.types';

import type { AdaptiveRecommendation, FeatureExtraction } from './types';

export const ExplanationTemplateKeys = [
  'activityColdStart', 'activityChallenge', 'activitySupport', 'activityHold',
  'explanationColdStart',
  'explanationAddChallenge',
  'explanationMoreSupport',
  'explanationPersonalPace',
  'explanationKeepLevel',
] as const satisfies readonly TranslationKey[];

export type ExplanationTemplateKey = (typeof ExplanationTemplateKeys)[number];

export function chooseExplanationTemplate(
  recommendation: AdaptiveRecommendation,
  extraction: FeatureExtraction,
  gameType: CognitiveActivityType = 'memory_match'
): ExplanationTemplateKey {
  if (gameType !== 'memory_match') {
    if (!extraction.hasPersonalBaseline) return 'activityColdStart';
    return recommendation.direction === 'challenge' ? 'activityChallenge' : recommendation.direction === 'gentler' ? 'activitySupport' : 'activityHold';
  }
  if (!extraction.hasPersonalBaseline) return 'explanationColdStart';
  if (recommendation.direction === 'challenge') return 'explanationAddChallenge';
  if (recommendation.direction === 'gentler') return 'explanationMoreSupport';
  if (extraction.features.relativePace >= 0.4 && extraction.features.relativePace <= 0.6) {
    return 'explanationPersonalPace';
  }
  return 'explanationKeepLevel';
}
