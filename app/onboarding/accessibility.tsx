import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Colors } from '@constants/colors';
import { Spacing } from '@constants/layout';
import type { TextSize } from '@db/schema.types';
import { getTextSizeName, t } from '@i18n/index';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import type { TextSizePreference } from '@constants/typography';

const textSizes: TextSize[] = ['standard', 'large', 'extra-large'];
const previewTextSizes: Record<TextSize, TextSizePreference> = {
  'extra-large': 'extraLarge',
  large: 'large',
  standard: 'normal',
};

type BinaryPreferenceProps = {
  language: 'en' | 'hi' | 'as';
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
    <View style={styles.preference}>
      <ThemedText type="cardHeading">{title}</ThemedText>
      <View style={styles.binaryChoices}>
        <SelectionCard
          icon="toggle-on"
          onPress={() => onChange(true)}
          reducedMotionOverride={reducedMotion || undefined}
          selected={value}
          selectedLabel={t(language, 'selected')}
          title={t(language, 'on')}
        />
        <SelectionCard
          icon="toggle-off"
          onPress={() => onChange(false)}
          reducedMotionOverride={reducedMotion || undefined}
          selected={!value}
          selectedLabel={t(language, 'selected')}
          title={t(language, 'off')}
        />
      </View>
    </View>
  );
}

export default function AccessibilityScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const accessibility = useOnboardingStore((state) => state.accessibility);
  const selectedLanguage = useOnboardingStore((state) => state.language);
  const language = selectedLanguage ?? 'en';
  const region = useOnboardingStore((state) => state.region);
  const role = useOnboardingStore((state) => state.role);
  const setAccessibility = useOnboardingStore((state) => state.setAccessibilityPreferences);
  const colors = Colors[colorScheme];

  return (
    <OnboardingScreen
      description={t(language, 'accessibilityIntro')}
      language={language}
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

      <BinaryPreference
        language={language}
        onChange={(highContrast) => setAccessibility({ highContrast })}
        reducedMotion={accessibility.reducedMotion}
        title={t(language, 'highContrast')}
        value={accessibility.highContrast}
      />
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

      <View style={styles.actions}>
        <SmaranButton
          accessibilityLabel={t(language, 'back')}
          label={t(language, 'back')}
          onPress={() => router.back()}
          reducedMotionOverride={accessibility.reducedMotion ? true : null}
          variant="outline"
        />
        <SmaranButton
          accessibilityLabel={t(language, 'continue')}
          disabled={role !== 'patient' || selectedLanguage === null || region === null}
          label={t(language, 'continue')}
          onPress={() => router.push('/onboarding/profile')}
          reducedMotionOverride={accessibility.reducedMotion ? true : null}
          size="large"
        />
      </View>
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
  binaryChoices: {
    gap: Spacing.md,
  },
  preview: {
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.md,
  },
});
