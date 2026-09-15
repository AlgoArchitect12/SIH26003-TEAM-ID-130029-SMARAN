import { useRef, useState } from 'react';
import { View } from 'react-native';
import { CareWorkspace } from '@components/caregiver/care-workspace';
import { ThemedText } from '@components/themed-text';
import { SmaranButton } from '@components/ui/smaran-button';
import { SmaranCard } from '@components/ui/smaran-card';
import { Field } from '@components/ui/smaran-field';
import { PageLayout } from '@constants/layout';
import { t, type TranslationKey } from '@i18n/index';
import { CareRelationships, CareRoles, CareScopes, effectiveScopes, type CareMember, type CareMemberInput } from '@/src/caregiver/care-circle';
import { careCircleRepository as repo } from '@/src/db/repositories/care-circle.repository';
import type { ActiveCare } from '@/src/services/care-circle.service';

const roleKeys = {family:'circleFamily',caregiver:'circleCaregiver',healthcare_worker:'circleWorker'} as const;
const relationshipKeys = {daughter:'circleDaughter',son:'circleSon',spouse:'circleSpouse',family_member:'circleFamily',caregiver:'circleCaregiver',healthcare_worker:'circleWorker'} as const;
const scopeKeys = {daily_activity:'circleDaily',reminders:'circleReminders',cognitive_activity:'circleCognitive',reports:'reportTitle',memories:'circleMemories'} as const;
const empty: CareMemberInput = {display_name:'',relationship:'family_member',access_role:'family',email:'',phone:'',scopes:[]};

export function CirclePanel({data,refresh}: {data: ActiveCare; refresh:()=>void}) {
  const language = data.settings.language;
  const [editing,setEditing] = useState<CareMember|null|undefined>();
  const [value,setValue] = useState<CareMemberInput>(empty), [confirm,setConfirm] = useState<string|null>(null);
  const [busy,setBusy] = useState(false), [failed,setFailed] = useState(false), lock = useRef(false);
  const label = (key:TranslationKey)=>t(language,key);
  const run = async (work:()=>Promise<unknown>)=>{
    if(lock.current || !data.current()) return;
    lock.current=true;setBusy(true);setFailed(false);
    try {await work();if(data.current()) refresh();} catch {if(data.current())setFailed(true);}
    finally {lock.current=false;if(data.current())setBusy(false);}
  };
  const edit = (member:CareMember|null)=>{setEditing(member);setFailed(false);setValue(member ? {...member,scopes:effectiveScopes(member)} : {...empty,scopes:[]});};
  return <>
    <ThemedText>{label('circleLocalNotice')}</ThemedText>
    <ThemedText type="cardHeading" accessibilityRole="header">{label('circleTrusted')}</ThemedText>
    {failed && <ThemedText accessibilityRole="alert">{label('circleFailed')}</ThemedText>}
    {editing !== undefined ? <SmaranCard style={PageLayout.group}>
      <ThemedText type="cardHeading">{label(editing ? 'circleEdit':'circleAdd')}</ThemedText>
      <Field label={label('circleName')} value={value.display_name} maxLength={80} editable={!busy} onChangeText={display_name=>setValue(v=>({...v,display_name}))} />
      <ThemedText type="action">{label('circleRelationship')}</ThemedText>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{CareRelationships.map(relationship=><SmaranButton key={relationship}
        label={label(relationshipKeys[relationship])} accessibilityLabel={label(relationshipKeys[relationship])} variant="outline" disabled={busy}
        accessibilityState={{selected:value.relationship===relationship}} onPress={()=>setValue(v=>({...v,relationship}))} />)}</View>
      <Field label={label('circleRelationship')} value={Object.hasOwn(relationshipKeys,value.relationship) ? label(relationshipKeys[value.relationship as keyof typeof relationshipKeys]) : value.relationship}
        maxLength={100} editable={!busy} onChangeText={relationship=>setValue(v=>({...v,relationship}))} />
      <ThemedText type="action">{label('circleRole')}</ThemedText>
      {CareRoles.map(access_role=><SmaranButton key={access_role} label={label(roleKeys[access_role])} accessibilityLabel={label(roleKeys[access_role])}
        variant="outline" disabled={busy} accessibilityState={{selected:value.access_role===access_role}} onPress={()=>setValue(v=>({...v,access_role}))} />)}
      <Field label={label('circleEmail')} value={value.email ?? ''} keyboardType="email-address" autoCapitalize="none" maxLength={254} editable={!busy} onChangeText={email=>setValue(v=>({...v,email}))} />
      <Field label={label('circlePhone')} value={value.phone ?? ''} keyboardType="phone-pad" maxLength={32} editable={!busy} onChangeText={phone=>setValue(v=>({...v,phone}))} />
      <ThemedText type="action">{label('circleAccess')}</ThemedText><ThemedText>{label('circleScopesNotice')}</ThemedText>
      {CareScopes.map(scope=><SmaranButton key={scope} label={label(scopeKeys[scope])} accessibilityLabel={label(scopeKeys[scope])} variant="outline" disabled={busy}
        accessibilityState={{selected:value.scopes.includes(scope)}} onPress={()=>setValue(v=>({...v,scopes:v.scopes.includes(scope)?v.scopes.filter(s=>s!==scope):[...v.scopes,scope]}))} />)}
      <SmaranButton label={label('circleSave')} accessibilityLabel={label('circleSave')} disabled={busy} loading={busy}
        onPress={()=>void run(()=>repo.save(data.patient.id,value,data.current,editing?.id))} />
      <SmaranButton label={label('circleCancel')} accessibilityLabel={label('circleCancel')} variant="outline" disabled={busy} onPress={()=>setEditing(undefined)} />
    </SmaranCard> : <SmaranButton label={label('circleAdd')} accessibilityLabel={label('circleAdd')} disabled={busy} onPress={()=>edit(null)} />}
    {!data.members.length && <ThemedText>{label('circleEmpty')}</ThemedText>}
    {data.members.map(member=><SmaranCard key={member.id} style={PageLayout.group}>
      <ThemedText type="cardHeading">{member.display_name}</ThemedText>
      <ThemedText>{Object.hasOwn(relationshipKeys,member.relationship) ? label(relationshipKeys[member.relationship as keyof typeof relationshipKeys]) : member.relationship} · {label(roleKeys[member.access_role])}</ThemedText>
      <ThemedText>{label(member.status==='local'?'circleLocal':'circleRevoked')}</ThemedText>
      {!!member.email && <ThemedText>{member.email}</ThemedText>}{!!member.phone && <ThemedText>{member.phone}</ThemedText>}
      <ThemedText>{label('circleAccess')}: {effectiveScopes(member).map(s=>label(scopeKeys[s])).join(', ') || label('circleNone')}</ThemedText>
      {member.status==='local' && <>
        <SmaranButton label={label('circleEdit')} accessibilityLabel={`${label('circleEdit')}: ${member.display_name}`} variant="outline" disabled={busy} onPress={()=>edit(member)} />
        {confirm===member.id ? <View style={PageLayout.group}><ThemedText accessibilityRole="alert">{label('circleConfirm')}</ThemedText>
          <SmaranButton label={label('circleRevoke')} accessibilityLabel={`${label('circleRevoke')}: ${member.display_name}`} disabled={busy} onPress={()=>void run(()=>repo.revoke(data.patient.id,member.id,data.current))} />
          <SmaranButton label={label('circleCancel')} accessibilityLabel={label('circleCancel')} variant="outline" disabled={busy} onPress={()=>setConfirm(null)} />
        </View> : <SmaranButton label={label('circleRevoke')} accessibilityLabel={`${label('circleRevoke')}: ${member.display_name}`} variant="outline" disabled={busy} onPress={()=>setConfirm(member.id)} />}
      </>}
    </SmaranCard>)}
  </>;
}
export default function CareCircleScreen() {
  return <CareWorkspace title="circleTitle">{(data,refresh)=><CirclePanel data={data} refresh={refresh} />}</CareWorkspace>;
}
