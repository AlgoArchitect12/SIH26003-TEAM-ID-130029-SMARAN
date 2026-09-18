import { SmaranButton } from '@components/ui/smaran-button';
import { AppearanceChoices } from '@components/ui/appearance-choices';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { Spacing } from '@constants/layout';
import type { Language, TextSize } from '@db/schema.types';
import { getTextSizeName, t } from '@i18n/index';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import type { TextSizePreference } from '@constants/typography';

const textSizes: TextSize[] = ['standard', 'large', 'extra-large'];
const previewTextSizes: Record<TextSize, TextSizePreference> = {
  'extra-large': 'extraLarge',
  large: 'large',
  standard: 'normal',
};

type BinaryPreferenceProps = {
  language: Language;
  onChange: (value: boolean) => void;
  reducedMotion: boolean;
  title: string;
  value: boolean;
};

function BinaryPreference({
  language,
  onChange,
  reducedMotion,
  title,
  value,
}: BinaryPreferenceProps) {
  return (
    <SmaranCard
      accessibilityLabel={`${title}. ${t(language, value ? 'on' : 'off')}`}
      accessibilityRole="switch"
      checked={value}
      onPress={() => onChange(!value)}
      reducedMotionOverride={reducedMotion ? true : null}
      selected={value}
      style={styles.toggleCard}>
      <View style={styles.toggleRow}>
        <ThemedText style={styles.toggleTitle} type="cardHeading">{title}</ThemedText>
        <ThemedText type="defaultSemiBold">{t(language, value ? 'on' : 'off')}</ThemedText>
      </View>
    </SmaranCard>
  );
}

export default function AccessibilityScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const accessibility = useOnboardingStore((state) => state.accessibility);
  const selectedLanguage = useOnboardingStore((state) => state.language);
  const language = selectedLanguage ?? 'en';
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);

  return (
    <OnboardingScreen
      description={t(language, 'accessibilityIntro')}
      language={language}
      onBack={() => router.dismissTo('/onboarding/language')}
      step={3}
      title={t(language, 'accessibilityTitle')}>
      <View style={styles.preference}>
        <ThemedText type="cardHeading">{t(language, 'textSize')}</ThemedText>
        <View style={styles.choices}>
          {textSizes.map((textSize) => (
            <SelectionCard
              icon="text-fields"
              key={textSize}
              onPress={() => setAccessibility({ textSize })}
              reducedMotionOverride={accessibility.reducedMotion || undefined}
              selected={accessibility.textSize === textSize}
              selectedLabel={t(language, 'selected')}
              title={getTextSizeName(language, textSize)}
            />
          ))}
        </View>
      </View>

      <SmaranCard
        accessibilityLabel={t(language, 'previewTitle')}
        style={[
          styles.preview,
          accessibility.highContrast && { borderColor: colors.text, borderWidth: 3 },
        ]}>
        <ThemedText type="cardHeading">{t(language, 'previewTitle')}</ThemedText>
        <ThemedText textSize={previewTextSizes[accessibility.textSize]}>
          {t(language, 'previewBody')}
        </ThemedText>
      </SmaranCard>

      <ThemedText type="cardHeading">{t(language, 'appearance')}</ThemedText>
      <AppearanceChoices language={language} />
      <BinaryPreference
        language={language}
        onChange={(voiceGuidance) => setAccessibility({ voiceGuidance })}
        reducedMotion={accessibility.reducedMotion}
        title={t(language, 'voiceGuidance')}
        value={accessibility.voiceGuidance}
      />
      <BinaryPreference
        language={language}
        onChange={(reducedMotion) => setAccessibility({ reducedMotion })}
        reducedMotion={accessibility.reducedMotion}
        title={t(language, 'reducedMotion')}
        value={accessibility.reducedMotion}
      />

      <SmaranButton label={t(language, 'continue')} accessibilityLabel={t(language, 'continue')}
        onPress={() => router.push('/onboarding/profile')} size="large" />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  preference: {
    gap: Spacing.md,
  },
  choices: {
    gap: Spacing.md,
  },
  toggleCard: { minHeight: 96 },
  toggleRow: { alignItems: 'flex-start', gap: Spacing.sm },
  toggleTitle: { flex: 1 },
  preview: {
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.md,
  },
});
