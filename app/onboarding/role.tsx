import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { SmaranButton } from '@components/ui/smaran-button';
import { Spacing } from '@constants/layout';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export default function RoleScreen() {
  const router = useRouter();
  const role = useOnboardingStore((state) => state.role);
  const language = useOnboardingStore((state) => state.language) ?? 'en';
  const setRole = useOnboardingStore((state) => state.setRole);

  return (
    <OnboardingScreen
      description={t(language, 'roleDescription')}
      language={language}
      step={1}
      title={t(language, 'roleTitle')}>
      <View style={styles.choices}>
        <SelectionCard
          description={t(language, 'selfDescription')}
          icon="person-outline"
          onPress={() => setRole('patient')}
          selected={role === 'patient'}
          selectedLabel={t(language, 'selected')}
          title={t(language, 'selfLabel')}
        />
        <SelectionCard
          description={t(language, 'caregiverDescription')}
          icon="favorite-outline"
          onPress={() => setRole('caregiver')}
          selected={role === 'caregiver'}
          selectedLabel={t(language, 'selected')}
          title={t(language, 'caregiverLabel')}
        />
      </View>

      <SmaranButton
        accessibilityLabel={t(language, role === 'caregiver' ? 'careOpen' : 'continue')}
        disabled={!role}
        label={t(language, role === 'caregiver' ? 'careOpen' : 'continue')}
        onPress={() => router.push(role === 'caregiver' ? { pathname: '/profiles', params: { view: 'caregiver' } } : '/onboarding/language')}
        size="large"
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  choices: {
    gap: Spacing.md,
  },
});
