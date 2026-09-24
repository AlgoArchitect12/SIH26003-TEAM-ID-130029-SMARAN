import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { scopeKeys } from '@components/caregiver/care-member-fields';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Field } from '@components/ui/smaran-field';
import { AiAssistant } from '@components/ai-assistant';
import { PageLayout } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { PairingScopes, pairingService, type GrantedSnapshot, type MembershipLink, type PairingRole } from '@/src/services/pairing.service';
import type { ActiveCare } from '@/src/services/care-circle.service';
import { captureAccount, useAuthStore } from '@/src/cloud/auth';
import { useOnboardingStore } from '@/src/stores/onboarding.store';
import { stopSpeech } from '@/src/services/speech.service';

export default function PairingPanel({ data }: { data?: ActiveCare }) {
  const router=useRouter();
  const language = useOnboardingStore(s=>s.language) ?? 'en';
  const authRevision = useAuthStore(s=>s.revision), focused = useIsFocused();
  const [label,setLabel] = useState(''), [scopes,setScopes] = useState<string[]>([]);
  const [role,setRole] = useState<PairingRole>('family');
  const [code,setCode] = useState(''), [expires,setExpires] = useState('');
  const [entry,setEntry] = useState('');
  const [links,setLinks] = useState<{received:MembershipLink[];granted:MembershipLink[]}|null>(null);
  const [viewed,setViewed] = useState<GrantedSnapshot|null>(null);
  const [edit,setEdit] = useState<{kind:'reminders'|'personal_memories';id:string;version:number;first:string;second:string;third:string}|null>(null);
  const [message,setMessage] = useState<TranslationKey|null>(null), [busy,setBusy] = useState(false);
  const generation = useRef(0), lock = useRef(false);
  useEffect(()=>{
    let live = true;
    const account = captureAccount();
    const clear = () => { generation.current++; lock.current=false; setBusy(false); setLinks(null); setViewed(null); setEdit(null); setCode(''); setExpires(''); setEntry(''); setMessage(null); void stopSpeech(); };
    const refresh = () => {
      clear();
      if (!focused) return;
      const request = generation.current;
      void pairingService.list().then(value => {if(live && account.current() && request===generation.current)setLinks(value);})
        .catch(()=>{if(live && request===generation.current)setMessage('pairingSignIn');});
    };
    refresh();
    const app = AppState.addEventListener('change',state=>{if(state==='active')refresh();else clear();});
    return ()=>{live=false;clear();app.remove();};
  },[data,authRevision,focused]);
  const run = async (work:(current:()=>boolean)=>Promise<void>) => {
    if(lock.current || !focused) return;
    const account = captureAccount(), request = ++generation.current;
    const current = () => account.current() && request===generation.current && (!data || data.current());
    lock.current=true;setBusy(true);setMessage(null);
    try {
      if (!current()) throw new Error('pairingSignIn');
      await work(current);
      const result = await pairingService.list();
      if(current())setLinks(result);
    } catch(error) {
      if(current()) {
        setViewed(null);setEdit(null);
        const key = error instanceof Error ? error.message : '';
        setMessage((['pairingSignIn','pairingOffline','pairingFailed','pairingInvalid','pairingExpired','pairingRateLimited','pairingForbidden'] as string[]).includes(key) ? key as TranslationKey : 'pairingFailed');
      }
    } finally { if(request===generation.current){lock.current=false;setBusy(false);} }
  };
  const open = (patientId:string) => {
    setViewed(null);setEdit(null);
    void run(async current=>{const snapshot=await pairingService.snapshot(patientId);if(current())setViewed(snapshot);});
  };
  return <View style={PageLayout.group}>
    <ThemedText>{t(language,'pairingPermissions')}</ThemedText>
    {data && <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading">{t(language,'pairingShare')}</ThemedText>
      <Field label={t(language,'pairingLabel')} value={label} maxLength={64} editable={!busy} onChangeText={setLabel}/>
      {(['family','caregiver','healthcare_worker'] as const).map(value=><SmaranButton key={value}
        label={t(language,value==='family'?'circleFamily':value==='caregiver'?'circleCaregiver':'circleWorker')}
        accessibilityLabel={t(language,value==='family'?'circleFamily':value==='caregiver'?'circleCaregiver':'circleWorker')}
        variant="outline" disabled={busy} accessibilityState={{selected:role===value}} onPress={()=>setRole(value)}/>)}
      {PairingScopes.map(scope=><SmaranButton key={scope} label={t(language,scopeKeys[scope])} accessibilityLabel={t(language,scopeKeys[scope])}
        variant="outline" disabled={busy} accessibilityState={{selected:scopes.includes(scope)}}
        onPress={()=>setScopes(old=>old.includes(scope)?old.filter(s=>s!==scope):[...old,scope])}/>)}
      <SmaranButton label={t(language,'pairingGenerate')} accessibilityLabel={t(language,'pairingGenerate')} disabled={busy||!scopes.length}
        onPress={()=>void run(async current=>{const result=await pairingService.generate(data.patient.id,scopes,label,role);if(current()){setCode(result.code);setExpires(result.expiresAt);}})}/>
      {!!code && <>
        <ThemedText type="screenTitle" selectable>{code}</ThemedText>
        <ThemedText>{t(language,'pairingCodeNote')}</ThemedText>
        <ThemedText>{t(language,'pairingExpires',{time:new Date(expires).toLocaleString()})}</ThemedText>
        <SmaranButton label={t(language,'pairingRevoke')} accessibilityLabel={t(language,'pairingRevoke')} disabled={busy} variant="outline"
          onPress={()=>void run(async current=>{await pairingService.revokeCodes(data.patient.id);if(current()){setCode('');setExpires('');}})}/>
      </>}
    </SmaranCard>}
    <Field label={t(language,'pairingEnterCode')} value={entry} maxLength={16} autoCapitalize="characters" editable={!busy} onChangeText={v=>setEntry(v.toUpperCase())}/>
    <SmaranButton label={t(language,'pairingClaim')} accessibilityLabel={t(language,'pairingClaim')} disabled={busy||!entry.trim()}
      onPress={()=>void run(async current=>{
        setViewed(null);setEdit(null);
        const grant=await pairingService.claim(entry);
        if(!current())return;
        setEntry('');
        const snapshot=await pairingService.snapshot(grant.patientId);
        if(current())setViewed(snapshot);
      })}/>
    {message && <ThemedText accessibilityRole="alert">{t(language,message)}</ThemedText>}
    <SmaranButton label={t(language,'retry')} accessibilityLabel={t(language,'retry')} disabled={busy} variant="outline"
      onPress={()=>void run(async()=>{setViewed(null);setEdit(null);})}/>
    {links?.received.map(link=><SmaranCard key={link.patientId} style={PageLayout.group}>
      {link.scopes.includes('location')&&<SmaranButton label={t(language,'gpsTitle')} accessibilityLabel={t(language,'gpsTitle')+': '+(link.displayName??link.patientId)}
        variant="outline" onPress={()=>router.push({pathname:'/caregiver/location',params:{patientId:link.patientId}})}/>}
      <ThemedText type="cardHeading">{link.displayName??link.patientId}</ThemedText>
      <ThemedText>{t(language,link.accessRole==='family'?'circleFamily':link.accessRole==='caregiver'?'circleCaregiver':'circleWorker')}</ThemedText>
      <SmaranButton label={t(language,'pairingView')} accessibilityLabel={t(language,'pairingView')+': '+(link.displayName??link.patientId)}
        disabled={busy} variant="outline" onPress={()=>open(link.patientId)}/>
      <SmaranButton label={t(language,'pairingLeave')} accessibilityLabel={t(language,'pairingLeave')+': '+(link.displayName??link.patientId)}
        disabled={busy} variant="outline" onPress={()=>void run(async()=>{setViewed(null);setEdit(null);await pairingService.revoke(link.patientId);})}/>
    </SmaranCard>)}
    {links?.granted.filter(link=>!data||link.patientId===data.patient.id).map(link=><SmaranCard key={link.patientId+link.memberId}>
      <ThemedText>{link.label||link.memberId}</ThemedText>
      {link.revoked ? <ThemedText>{t(language,'circleRevoked')}</ThemedText> :
        <SmaranButton label={t(language,'pairingRevoke')} accessibilityLabel={t(language,'pairingRevoke')+': '+(link.label||link.memberId)}
          variant="outline" disabled={busy} onPress={()=>void run(async()=>{setViewed(null);await pairingService.revoke(link.patientId,link.memberId);})}/>}
    </SmaranCard>)}
    {viewed && <View key={viewed.patientId} style={PageLayout.group}>
      <ThemedText type="cardHeading">{viewed.displayName??viewed.patientId}</ThemedText>
      {viewed.sessions?.map((s,i)=><ThemedText key={i}>{s.game} · {s.completed}</ThemedText>)}
      {viewed.reminders?.map(r=><SmaranCard key={r.id} style={PageLayout.group}>
        <ThemedText>{r.title} · {r.time}</ThemedText>
        <SmaranButton label={t(language,'circleEdit')} accessibilityLabel={t(language,'circleEdit')+': '+r.title} variant="outline" disabled={busy}
          onPress={()=>setEdit({kind:'reminders',id:r.id,version:r.version,first:r.title,second:r.time,third:''})}/>
      </SmaranCard>)}
      {viewed.memories?.map(m=><SmaranCard key={m.id} style={PageLayout.group}>
        <ThemedText>{m.name} · {m.relationship}</ThemedText><ThemedText>{m.description}</ThemedText>
        <SmaranButton label={t(language,'memoryEdit')} accessibilityLabel={t(language,'memoryEdit')+': '+m.name} variant="outline" disabled={busy}
          onPress={()=>setEdit({kind:'personal_memories',id:m.id,version:m.version,first:m.name,second:m.relationship,third:m.description})}/>
      </SmaranCard>)}
      {viewed.reports?.map((r,i)=><ThemedText key={i}>{t(language,'reportTitle')}: {r.period_start} – {r.period_end}</ThemedText>)}
      {edit && <SmaranCard style={PageLayout.group}>
        <Field label={t(language,edit.kind==='reminders'?'dayTitle':'memoryName')} value={edit.first} maxLength={edit.kind==='reminders'?120:100} onChangeText={first=>setEdit({...edit,first})} editable={!busy}/>
        <Field label={t(language,edit.kind==='reminders'?'dayTime':'memoryRelationship')} value={edit.second} maxLength={edit.kind==='reminders'?5:100} onChangeText={second=>setEdit({...edit,second})} editable={!busy}/>
        {edit.kind==='personal_memories' && <Field label={t(language,'memoryDescription')} value={edit.third} maxLength={500} multiline onChangeText={third=>setEdit({...edit,third})} editable={!busy}/>}
        <SmaranButton label={t(language,'circleSave')} accessibilityLabel={t(language,'circleSave')} disabled={busy}
          onPress={()=>void run(async current=>{
            const patch: Record<string,string> = edit.kind==='reminders'?{title:edit.first,time_of_day:edit.second}:{name:edit.first,relationship:edit.second,description:edit.third};
            await pairingService.update(viewed.patientId,edit.kind,edit.id,edit.version,patch);
            if(!current())return;
            setViewed(null);setEdit(null);
            const result=await pairingService.snapshot(viewed.patientId);
            if(current()){setViewed(result);setMessage('remoteSaved');}
          })}/>
        <SmaranButton label={t(language,'circleCancel')} accessibilityLabel={t(language,'circleCancel')} disabled={busy} variant="outline" onPress={()=>setEdit(null)}/>
      </SmaranCard>}
      <AiAssistant key={viewed.patientId+'-'+generation.current} patientId={viewed.patientId} language={language}/>
    </View>}
  </View>;
}

