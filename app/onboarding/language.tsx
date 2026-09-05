import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { Languages } from '@db/schema.types';
import { getLanguageHelper, getLanguageName, t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

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
      onBack={() => router.back()}
      step={2}
      title={t(activeLanguage, 'languageTitle')}>
      <View style={styles.choices}>
        {Languages.map((option) => (
          <SelectionCard
            icon="language"
            key={option}
            onPress={() => setLanguage(option)}
            description={getLanguageHelper(option)}
            selected={language === option}
            selectedLabel={t(activeLanguage, 'selected')}
            title={getLanguageName(option)}
          />
        ))}
      </View>
      <View style={styles.actions}>
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
