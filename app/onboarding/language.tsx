import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import type { Language } from '@db/schema.types';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

const languages: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'as', label: 'অসমীয়া' },
];

export default function LanguageScreen() {
  const router = useRouter();
  const language = useOnboardingStore((state) => state.language);
  const role = useOnboardingStore((state) => state.role);
  const setLanguage = useOnboardingStore((state) => state.setLanguage);
  const activeLanguage = language ?? 'en';

  return (
    <OnboardingScreen
      description={t(activeLanguage, 'languageIntro')}
      language={activeLanguage}
      title={t(activeLanguage, 'languageTitle')}>
      <View style={styles.choices}>
        {languages.map((option) => (
          <SelectionCard
            icon="language"
            key={option.id}
            onPress={() => setLanguage(option.id)}
            selected={language === option.id}
            selectedLabel={t(activeLanguage, 'selected')}
            title={option.label}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <SmaranButton
          accessibilityLabel={t(activeLanguage, 'back')}
          label={t(activeLanguage, 'back')}
          onPress={() => router.back()}
          variant="outline"
        />
        <SmaranButton
          accessibilityLabel={t(activeLanguage, 'continue')}
          disabled={role !== 'patient' || language === null}
          label={t(activeLanguage, 'continue')}
          onPress={() => router.push('/onboarding/region')}
          size="large"
        />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  choices: {
    gap: Spacing.md,
  },
  actions: {
    gap: Spacing.md,
  },
});
