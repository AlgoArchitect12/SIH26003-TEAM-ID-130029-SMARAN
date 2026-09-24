import PairingPanel from '@components/caregiver/pairing-panel';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { SmaranButton } from '@components/ui/smaran-button';
import { ThemedText } from '@components/themed-text';
import { PageLayout } from '@constants/layout';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { useAuthStore } from '@/src/cloud/auth';
import { usePatientSessionStore } from '@/src/stores/patient-session.store';
import { loadActiveCare, type ActiveCare } from '@/src/services/care-circle.service';

export default function PairingScreen() {
  const router = useRouter(), language = useOnboardingStore(s=>s.language) ?? 'en';
  const revision = usePatientSessionStore(s=>s.revision), accountRevision = useAuthStore(s=>s.revision);
  const [data,setData] = useState<ActiveCare>();
  useEffect(()=>{
    let live=true;setData(undefined);
    void loadActiveCare().then(value=>{if(live && value?.current())setData(value);}).catch(()=>{});
    return()=>{live=false;};
  },[revision,accountRevision]);
  return <ScreenWrapper scroll><View style={PageLayout.content}>
    <ThemedText type="screenTitle">{t(language,'pairingTitle')}</ThemedText>
    <SmaranButton label={t(language,'back')} accessibilityLabel={t(language,'back')} variant="outline" onPress={()=>router.replace('/account')}/>
    <PairingPanel key={`${revision}-${accountRevision}`} data={data}/>
  </View></ScreenWrapper>;
}
