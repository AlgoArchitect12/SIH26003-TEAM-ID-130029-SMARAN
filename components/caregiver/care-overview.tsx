import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@components/themed-text';
import { SmaranCard } from '@components/ui/smaran-card';
import { SmaranButton } from '@components/ui/smaran-button';
import { PageLayout } from '@constants/layout';
import { t } from '@i18n/index';
import type { Language } from '@/src/db/schema.types';
import { loadActiveCare, type ActiveCare } from '@/src/services/care-circle.service';
import { usePatientSessionStore } from '@/src/stores/patient-session.store';
import { CareNavigation } from './care-workspace';

export function CareOverview({language}: {language:Language}) {
  const focused=useIsFocused(), revision=usePatientSessionStore(s=>s.revision), router=useRouter();
  const [data,setData]=useState<ActiveCare|null>(null), [failed,setFailed]=useState(false), [attempt,setAttempt]=useState(0);
  useEffect(()=>{let live=true;setData(null);setFailed(false);
    if(focused)void loadActiveCare().then(value=>{if(live && value?.current())setData(value);}).catch(()=>{if(live)setFailed(true);});
    return ()=>{live=false;};
  },[focused,revision,attempt]);
  const visible=focused && data?.current()?data:null;
  return <View style={PageLayout.group}>
    <CareNavigation language={language} />
    {failed && <View style={PageLayout.group}><ThemedText accessibilityRole="alert">{t(language,'circleFailed')}</ThemedText>
      <SmaranButton label={t(language,'retry')} accessibilityLabel={t(language,'retry')} onPress={()=>setAttempt(n=>n+1)} /></View>}
    {visible && <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading">{t(language,'circleTitle')}</ThemedText>
      <ThemedText>{t(language,'circleCount',{count:String(visible.members.filter(m=>m.status==='local').length)})}</ThemedText>
      <ThemedText type="cardHeading">{t(language,'reportTitle')}</ThemedText>
      {!visible.reports.length && <ThemedText>{t(language,'reportEmpty')}</ThemedText>}
      {visible.reports.slice(0,3).map(report=><SmaranButton key={report.id} variant="outline"
        label={`${t(language,'reportSummary')} · ${new Date(report.generated_at).toLocaleDateString(language)}`}
        accessibilityLabel={`${t(language,'reportSummary')} · ${new Date(report.generated_at).toLocaleDateString(language)}`}
        onPress={()=>router.push('/caregiver/reports')} />)}
    </SmaranCard>}
  </View>;
}
