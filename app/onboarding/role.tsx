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
  const setRole = useOnboardingStore((state) => state.setRole);

  return (
    <OnboardingScreen
      description={t('en', 'roleDescription')}
      language="en"
      title={t('en', 'roleTitle')}>
      <View style={styles.choices}>
        <SelectionCard
          description={t('en', 'selfDescription')}
          icon="person-outline"
          onPress={() => setRole('patient')}
          selected={role === 'patient'}
          selectedLabel={t('en', 'selected')}
          title={t('en', 'selfLabel')}
        />
        <SelectionCard
          description={t('en', 'caregiverDescription')}
          icon="favorite-outline"
          onPress={() => setRole('caregiver')}
          selected={role === 'caregiver'}
          selectedLabel={t('en', 'selected')}
          title={t('en', 'caregiverLabel')}
        />
      </View>

      {role === 'caregiver' ? (
        <SmaranCard accessibilityLabel={t('en', 'caregiverNoticeTitle')} style={styles.notice}>
          <ThemedText type="cardHeading">{t('en', 'caregiverNoticeTitle')}</ThemedText>
          <ThemedText>{t('en', 'caregiverNoticeBody')}</ThemedText>
        </SmaranCard>
      ) : null}

      {role === 'caregiver' ? (
        <SmaranButton
          accessibilityLabel={t('en', 'changeRole')}
          label={t('en', 'changeRole')}
          onPress={() => setRole(null)}
          variant="outline"
        />
      ) : (
        <SmaranButton
          accessibilityLabel={t('en', 'continue')}
          disabled={role !== 'patient'}
          label={t('en', 'continue')}
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
