import type { PropsWithChildren } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { ThemedText } from '@components/themed-text';
import { PageLayout } from '@constants/layout';
import { t } from '@i18n/index';
import type { Language } from '@db/schema.types';

export function PatientPage({ children, title, language, patientId, failed, retry }: PropsWithChildren<{
  title: string; language: Language; patientId: string | null; failed: boolean; retry: () => void;
}>) {
  const router = useRouter();
  const path = usePathname();
  return <ScreenWrapper scroll><View style={PageLayout.content}>
    <SmaranButton label={t(language, 'back')} accessibilityLabel={t(language, 'back')} variant="outline"
      style={{ alignSelf: 'flex-start' }} onPress={() => path === '/patient/menu' ? router.dismissTo('/patient/home') : router.canGoBack() ? router.back() : router.dismissTo('/patient/menu')} />
    <ThemedText type="screenTitle">{title}</ThemedText>
    {failed ? <View style={PageLayout.group}>
      <ThemedText accessibilityRole="alert">{t(language, 'errorSafeTitle')}</ThemedText>
      <SmaranButton label={t(language, 'retry')} accessibilityLabel={t(language, 'retry')} onPress={retry} />
    </View> : !patientId ? <SmaranLoading label={t(language, 'loadingSetup')} /> : children}
  </View></ScreenWrapper>;
}
