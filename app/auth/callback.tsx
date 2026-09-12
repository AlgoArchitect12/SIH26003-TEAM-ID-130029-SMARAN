import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

// The root auth lifecycle consumes the exact Linking URL; Router parameters never supply tokens or redirect destinations.
export default function AuthCallback() {
  const router = useRouter();
  const language = useOnboardingStore(s => s.language) ?? 'en';
  useEffect(() => { router.replace('/account'); }, [router]);
  return <ScreenWrapper><SmaranLoading label={t(language, 'accountRestoring')} /></ScreenWrapper>;
}
