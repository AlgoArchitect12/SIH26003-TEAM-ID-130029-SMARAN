import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { SelectionCard } from '@components/onboarding/selection-card';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
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

      {role === 'caregiver' ? (
        <SmaranCard accessibilityLabel={t(language, 'caregiverNoticeTitle')} style={styles.notice}>
          <ThemedText type="cardHeading">{t(language, 'caregiverNoticeTitle')}</ThemedText>
          <ThemedText>{t(language, 'caregiverNoticeBody')}</ThemedText>
        </SmaranCard>
      ) : null}

      {role === 'caregiver' ? (
        <SmaranButton
          accessibilityLabel={t(language, 'changeRole')}
          label={t(language, 'changeRole')}
          onPress={() => setRole(null)}
          variant="outline"
        />
      ) : (
        <SmaranButton
          accessibilityLabel={t(language, 'continue')}
          disabled={role !== 'patient'}
          label={t(language, 'continue')}
          onPress={() => router.push('/onboarding/language')}
          size="large"
        />
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  choices: {
    gap: Spacing.md,
  },
  notice: {
    gap: Spacing.sm,
  },
});
