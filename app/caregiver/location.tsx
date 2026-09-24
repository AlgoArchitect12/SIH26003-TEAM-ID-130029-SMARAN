import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { SmaranButton } from '@components/ui/smaran-button';
import { ThemedText } from '@components/themed-text';
import { LocationPanel } from '@components/location/location-panel';
import { PageLayout } from '@constants/layout';
import { t } from '@i18n/index';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { resolveActivePatient } from '@/src/services/active-patient.service';
import { usePatientSessionStore } from '@/src/stores/patient-session.store';
export default function CaregiverLocationScreen() {
  const {patientId}=useLocalSearchParams<{patientId?:string}>(),router=useRouter();
  const language=useOnboardingStore(s=>s.language)??'en',revision=usePatientSessionStore(s=>s.revision);
  const [local,setLocal]=useState<string|null>(null);
  useEffect(()=>{let active=true;setLocal(null);if(!patientId)void resolveActivePatient().then(result=>{
    if(active&&result.status==='ready')setLocal(result.profile.id);
  }).catch(()=>{});return()=>{active=false;};},[patientId,revision]);
  const id=typeof patientId==='string'?patientId:local;
  return <ScreenWrapper scroll><View style={PageLayout.content}>
    <SmaranButton label={t(language,'back')} accessibilityLabel={t(language,'back')} variant="outline" onPress={()=>router.canGoBack()?router.back():router.replace('/caregiver/pairing')}/>
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language,'gpsTitle')}</ThemedText>
    {id?<LocationPanel key={id} patientId={id} language={language}/>:<ThemedText>{t(language,'gpsNoPair')}</ThemedText>}
    <SmaranButton label={t(language,'pairingTitle')} accessibilityLabel={t(language,'pairingTitle')} variant="outline" onPress={()=>router.push('/caregiver/pairing')}/>
  </View></ScreenWrapper>;
}
