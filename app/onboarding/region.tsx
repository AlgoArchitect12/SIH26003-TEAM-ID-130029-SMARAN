import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { Regions } from '@db/schema.types';
import { getRegionName, t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export default function RegionScreen() {
  const router = useRouter();
  const selectedLanguage = useOnboardingStore((state) => state.language);
  const language = selectedLanguage ?? 'en';
  const region = useOnboardingStore((state) => state.region);
  const role = useOnboardingStore((state) => state.role);
  const setRegion = useOnboardingStore((state) => state.setRegion);

  return (
    <OnboardingScreen
      description={t(language, 'regionIntro')}
      language={language}
      onBack={() => router.dismissTo('/onboarding/profile')}
      step={4}
      title={t(language, 'regionTitle')}>
      <View style={styles.choices}>
        {Regions.map((option) => (
          <SelectionCard
            icon="place"
            key={option}
            onPress={() => setRegion(option)}
            selected={region === option}
            selectedLabel={t(language, 'selected')}
            title={getRegionName(language, option)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <SmaranButton
          accessibilityLabel={t(language, 'continue')}
          disabled={role !== 'patient' || selectedLanguage === null || region === null}
          label={t(language, 'continue')}
          onPress={() => router.push('/onboarding/accessibility')}
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
