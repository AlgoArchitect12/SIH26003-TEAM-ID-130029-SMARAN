import { useRouter } from 'expo-router';
import { OnboardingScreen } from '@components/onboarding/onboarding-screen';
import { CareMemberFields } from '@components/caregiver/care-member-fields';
import { SmaranButton } from '@components/ui/smaran-button';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export default function CaregiverSetup() {
  const router = useRouter();
  const { language: chosen, caregiver, setCaregiverDraft, role } = useOnboardingStore();
  const language = chosen ?? 'en';
  return <OnboardingScreen language={language} title={t(language, 'caregiverLabel')}
    description={t(language, 'circleLocalNotice')} step={5} onBack={() => router.dismissTo('/onboarding/profile')}>
    {role === 'caregiver' && <><CareMemberFields language={language} value={caregiver} onChange={setCaregiverDraft} />
    <SmaranButton
      accessibilityLabel={t(language, 'continue')}
      label={t(language, 'continue')}
      disabled={!caregiver.display_name.trim()}
      onPress={() => router.push('/onboarding/region')}
      size="large" />
    </>}
  </OnboardingScreen>;
}
