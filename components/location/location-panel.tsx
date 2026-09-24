import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Field } from '@components/ui/smaran-field';
import { SmaranLoading } from '@components/ui/smaran-loading';
import { t, type TranslationKey } from '@i18n/index';
import type { Language } from '@/src/db/schema.types';
import { captureAccount, useAuthStore } from '@/src/cloud/auth';
import { freshness, newerSnapshot, type SafeZone } from '@/src/location/live';
import { setLocationSharing, useLocationStore, watchPatientLocation, type LiveLocationState } from '@/src/services/location.service';
import { LocationMap } from './location-map';
const errors:TranslationKey[]=['gpsDenied','gpsDisabled','gpsForbidden','gpsSignIn','gpsOffline','gpsFailed','gpsConsentRequired','gpsInvalidZone'];
export function LocationPanel({patientId,language,device=false}: {patientId:string;language:Language;device?:boolean}) {
  const focused=useIsFocused(), router=useRouter(), revision=useAuthStore(s=>s.revision), auth=useAuthStore(s=>s.status);
  const local=useLocationStore();
  const [live,setLive]=useState<LiveLocationState>({snapshot:null,status:'gpsLoading'});
  const [attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState<TranslationKey|null>(null);
  const [radius,setRadius]=useState('300'),[now,setNow]=useState(Date.now());
  const [loadedRevision,setLoadedRevision]=useState(-1);
  useEffect(()=>{
    let active=true;setLive({snapshot:null,status:'gpsLoading'});setMessage(null);
    let stop:undefined|(()=>void);
    if(focused&&auth==='signed-in') {
      try {stop=watchPatientLocation(patientId,value=>{if(active){
        setLive(old=>({...value,snapshot:value.snapshot?newerSnapshot(old.snapshot,value.snapshot):null}));setLoadedRevision(revision);
      }});}
      catch {setLive({snapshot:null,status:'gpsSignIn'});}
    } else setLive({snapshot:null,status:'gpsSignIn'});
    const app=AppState.addEventListener('change',state=>{if(state==='active')setAttempt(n=>n+1);});
    const timer=setInterval(()=>setNow(Date.now()),15000);
    return ()=>{active=false;stop?.();app.remove();clearInterval(timer);};
  },[patientId,revision,auth,focused,attempt]);
  const snapshot=focused&&auth==='signed-in'&&loadedRevision===revision?live.snapshot:null;
  const point=snapshot?.point??(device&&focused&&auth==='signed-in'&&local.patientId===patientId?local.point:null);
  const action=async(kind:'consent'|'pause'|'resume'|'revoke'|'zone',zone:SafeZone|null=null)=>{
    if(busy)return;setBusy(true);setMessage(null);
    const account=captureAccount();
    try {
      const result=await setLocationSharing(patientId,kind,zone,device);
      if(account.current()){setLive({snapshot:result,status:'gpsConnected'});setMessage('gpsSaved');}
    } catch(error) {
      if(account.current()) {
        const key=error instanceof Error?error.message as TranslationKey:'gpsFailed';
        setMessage(device&&(kind==='pause'||kind==='revoke')?'gpsPending':errors.includes(key)?key:'gpsFailed');
        if(kind==='revoke')setLive({snapshot:null,status:'gpsReconnecting'});
      }
    } finally {setBusy(false);}
  };
  const button=(key:TranslationKey,run:()=>void,disabled=false)=><SmaranButton label={t(language,key)} accessibilityLabel={t(language,key)}
    disabled={busy||disabled} variant="outline" onPress={run}/>;
  return <View style={{gap:16}}>
    <SmaranCard style={{gap:12}}>
      {!!snapshot?.display_name&&<ThemedText type="cardHeading" accessibilityRole="header">{snapshot.display_name}</ThemedText>}
      <ThemedText>{t(language,'gpsConsent')}</ThemedText>
      <ThemedText type="secondary">{t(language,'gpsForeground')}</ThemedText>
      <ThemedText accessibilityLiveRegion="polite">{t(language,live.status)}</ThemedText>
      {live.status==='gpsLoading'&&<SmaranLoading label={t(language,'gpsLoading')}/>}
      {snapshot?.device_status==='denied'&&<ThemedText accessibilityRole="alert">{t(language,'gpsDenied')}</ThemedText>}
      {snapshot?.device_status==='disabled'&&<ThemedText accessibilityRole="alert">{t(language,'gpsDisabled')}</ThemedText>}
      {device&&local.patientId===patientId&&<ThemedText accessibilityLiveRegion="polite">{t(language,local.status)}</ThemedText>}
      {snapshot&&!snapshot.enabled&&<ThemedText>{t(language,'gpsPaused')}</ThemedText>}
      {message&&<ThemedText accessibilityRole="alert">{t(language,message)}</ThemedText>}
      {auth!=='signed-in'&&button('accountTitle',()=>router.push('/account'))}
      {device&&button('gpsEnable',()=>void action('consent'),auth!=='signed-in')}
      {snapshot?.consent&&<>
        {button(snapshot.enabled?'gpsPause':'gpsResume',()=>void action(snapshot.enabled?'pause':'resume'))}
        {button('gpsRevoke',()=>void action('revoke'))}
      </>}
      {device&&(local.status==='gpsDenied'||local.status==='gpsDisabled')&&button('menuSettings',()=>void Linking.openSettings().catch(()=>setMessage('gpsFailed')))}
      {button('retry',()=>setAttempt(n=>n+1))}
    </SmaranCard>
    <ThemedText type="cardHeading" accessibilityRole="header">{t(language,freshness(point,now))}</ThemedText>
    {point&&freshness(point,now)!=='gpsUnavailable'&&<>
      <LocationMap point={point} zone={snapshot?.zone??null} language={language}/>
      <ThemedText>{t(language,'gpsCoordinates',{latitude:String(point.latitude.toFixed(5)),longitude:String(point.longitude.toFixed(5))})}</ThemedText>
      <ThemedText>{t(language,'gpsTime',{time:new Date(point.recorded_at).toLocaleString(language)})}</ThemedText>
      {point.accuracy!==null&&<ThemedText>{t(language,'gpsAccuracy',{metres:String(Math.round(point.accuracy))})}</ThemedText>}
    </>}
    {snapshot&&<ThemedText>{t(language,'gpsHistory',{count:String(snapshot.history.length)})}</ThemedText>}
    {!device&&snapshot?.consent&&<SmaranCard style={{gap:12}}>
      <ThemedText type="cardHeading" accessibilityRole="header">{t(language,'gpsZone')}</ThemedText>
      {snapshot.zone&&<ThemedText>{t(language,'gpsCoordinates',{latitude:String(snapshot.zone.latitude),longitude:String(snapshot.zone.longitude)})} · {snapshot.zone.radius} m</ThemedText>}
      <Field label={t(language,'gpsRadius')} value={radius} onChangeText={setRadius} keyboardType="number-pad" maxLength={5} editable={!busy}/>
      {button('gpsSetZone',()=>{if(point)void action('zone',{latitude:point.latitude,longitude:point.longitude,radius:Number(radius)});},!point||freshness(point,now)!=='gpsCurrent')}
      {snapshot.zone&&button('gpsClearZone',()=>void action('zone'))}
      {snapshot.event&&<ThemedText accessibilityLiveRegion="polite">{t(language,snapshot.event.kind==='entry'?'gpsEntry':'gpsExit')} · {new Date(snapshot.event.at).toLocaleString(language)}</ThemedText>}
    </SmaranCard>}
  </View>;
}
