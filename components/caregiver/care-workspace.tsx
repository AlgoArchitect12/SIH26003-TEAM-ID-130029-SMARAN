import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@components/layout/screen-wrapper';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { CurrentPerson } from '@components/patient/current-person';
import { SyncStatus } from '@components/caregiver/sync-status';
import { PageLayout } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { usePatientSessionStore } from '@/src/stores/patient-session.store';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { loadActiveCare, type ActiveCare } from '@/src/services/care-circle.service';
import type { Language } from '@/src/db/schema.types';
import { applyPatientSettings } from '@/src/services/profile-switching.service';

export function CareNavigation({language}: {language: Language}) {
  const router = useRouter();
  const links = [['circleOverview','/caregiver/home'],['circleActivity','/caregiver/activity'],['circleReminders','/caregiver/reminders'],
    ['locationTitle','/caregiver/location'],['reportTitle','/caregiver/reports'],['circleTitle','/caregiver/circle']] as const;
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{links.map(([key,path]) =>
    <SmaranButton key={key} label={t(language,key)} accessibilityLabel={t(language,key)} variant="outline"
      style={{flexGrow:1,flexBasis:180}} onPress={()=>router.replace(path)} />)}</View>;
}
export function CareWorkspace({title,children}: {title: TranslationKey; children: (data: ActiveCare, refresh:()=>void) => ReactNode}) {
  const focused = useIsFocused(), revision = usePatientSessionStore(s=>s.revision);
  const language = useOnboardingStore(s=>s.language) ?? 'en';
  const [data,setData] = useState<ActiveCare|null>(null), [failed,setFailed] = useState(false), [attempt,setAttempt] = useState(0);
  useEffect(()=>{
    let live = true; setData(null); setFailed(false);
    if (focused) void loadActiveCare().then(value=>{
      if (!live || (value && !value.current())) return;
      if (value) applyPatientSettings(value.settings);
      setData(value); setFailed(!value);
    }).catch(()=>{if(live) setFailed(true);});
    return ()=>{live=false;};
  },[focused,revision,attempt]);
  const visible = focused && data?.current() ? data : null;
  return <ScreenWrapper scroll><View style={PageLayout.content}>
    <ThemedText type="screenTitle" accessibilityRole="header">{t(language,title)}</ThemedText>
    <CurrentPerson name={visible?.patient.preferredName} language={language} caregiver />
    <SyncStatus language={language} patientId={visible?.patient.id ?? null} />
    <CareNavigation language={language} />
    {failed ? <View style={PageLayout.group}><ThemedText accessibilityRole="alert">{t(language,'circleFailed')}</ThemedText>
      <SmaranButton label={t(language,'retry')} accessibilityLabel={t(language,'retry')} onPress={()=>setAttempt(n=>n+1)} /></View>
      : visible ? <View key={`${visible.patient.id}-${revision}`} style={PageLayout.group}>{children(visible,()=>setAttempt(n=>n+1))}</View>
        : <SmaranLoading label={t(language,'loadingSetup')} />}
  </View></ScreenWrapper>;
}
